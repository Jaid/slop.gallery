import type {Node} from 'three/webgpu'

import {color, float, hash, max, min, mix, mx_noise_float, mx_worley_noise_float, normalView, positionViewDirection, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band} from '../lib/materials/carving.ts'
import {fittedPeriod, frameSurface} from '../lib/materials/frameAttributes.ts'
import FrameMetalMaterial, {bronze} from '../lib/materials/FrameMetalMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import FrameWoodMaterial, {ebony} from '../lib/materials/FrameWoodMaterial.ts'
import {turned} from '../lib/ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.058
const wood = 0
const sigils = 1
const crystal = 2
const stand = 3
/** the charred band the sigils are burned into */
const inscription = {
  from: 0.012,
  to: 0.07,
  z: -0.05,
  /** how wide a sigil’s cell is along the band, about */
  cell: 0.032,
}
/** an ebony bead at the sight edge, the charred band of sigils sunk below it, an ebony round and a cove to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], wood)
  .line(-0.005, -0.048)
  .arc(0.008, -0.048, 0.5, {steps: 8})
  .line(inscription.from, inscription.z)
  .line(inscription.to, inscription.z, {material: sigils})
  .line(0.072, -0.046, {material: wood})
  .arc(0.098, -0.032, 0.25, {steps: 10})
  .arc(0.118, -0.07, -0.2, {steps: 6})
  .line(0.118, frameBack)
  .line(-0.005, frameBack)
/** the crystal balls on the corners: their radius and how high their stands lift them off the band */
const ball = {
  radius: 0.024,
  lift: 0.008,
}
/** the points a sigil’s strokes join, three across and three up, from 0 to 1 within its cell */
const lattice = [0.22, 0.5, 0.78] as const
/** the strokes a sigil may be made of, between points of the lattice by their column and row, and how likely each is drawn */
const strokes = [
  ...[0, 1, 2].flatMap(row => [[[0, row], [1, row], 0.32], [[1, row], [2, row], 0.32]] as const),
  ...[0, 2].flatMap(column => [[[column, 0], [column, 1], 0.34], [[column, 1], [column, 2], 0.34]] as const),
  [[1, 0], [1, 1], 0.72],
  [[1, 1], [1, 2], 0.72],
  ...[[0, 0], [2, 0], [0, 2], [2, 2]].map(point => [point, [1, 1], 0.26] as const),
] as const

/** One of the Spook Orb’s frames: ebony round a charred band of glowing occult sigils, which light up one after another as if something spelled them out, a crystal ball swirling with green mist on every corner. */
export default class SeanceFrame extends PortraitFrame {
  override readonly description = 'Fetched from a medium’s parlor: polished ebony round a charred band burned with occult sigils that glow spectral green, flaring one after another as if something were spelling a message along them, and on every corner a crystal ball on a bronze stand, green mist swirling inside it.'
  override readonly front = inscription.z + ball.lift + ball.radius * 2
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#1a2a22'
  override readonly title = 'Séance'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const middle = (inscription.from + inscription.to) / 2
    const foot = turned([[0.016, 0], [0.016, 0.0025], [0.011, 0.004], [0.013, 0.0065], [0.0115, ball.lift], [0, ball.lift]], 12, {kind: 1})
    const sphere = turned(Array.from({length: 9}, (_, index) => {
      const angle = -Math.PI / 2 + index / 8 * Math.PI
      return [index === 0 || index === 8 ? 0 : Math.cos(angle) * ball.radius, Math.sin(angle) * ball.radius] as const
    }), 14, {kind: 2})
    const spots = corners(halfWidth, halfHeight, middle, inscription.z)
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [stand, place(foot, spots)],
      [crystal, place(sphere, spots.map(({position: [x, y, z]}) => ({position: [x, y, z + ball.lift + ball.radius - 0.004] as const})))],
    ])
  }

  protected override createMaterials() {
    return [
      new FrameWoodMaterial({
        timber: ebony,
        gloss: 0.7,
        roughness: 0.3,
        grime: 0.4,
      }),
      new SigilMaterial,
      new CrystalMaterial,
      new FrameMetalMaterial({metal: bronze}),
    ]
  }
}

/**
 * Charred wood burned with sigils: every cell along the band holds one, a few strokes between the points of a lattice that a hash of the cell picks, glowing spectral green with a burnt halo. They smolder faintly and flare one after another along every member, as if something spelled a message along them, and the char between them is cracked, the cracks glowing a little too.
 */
class SigilMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.85,
      envMap: frameStudio,
      envMapIntensity: 0.4,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const height = inscription.to - inscription.from
    const period = fittedPeriod(surface.openingHalf, inscription.cell, (inscription.from + inscription.to) / 2)
    const cell = surface.along.div(period).floor()
    const id = cell.add(surface.member.mul(1000))
    const g = vec2(surface.along.div(period).fract(), band(surface, inscription.from, inscription.to).t)
    // In meters within the cell, so strokes keep their width.
    const at = g.mul(vec2(period, height))
    let distance: Float = float(1)
    for (const [index, [[ax, ay], [bx, by], chance]] of strokes.entries()) {
      const a = vec2(lattice[ax], lattice[ay]).mul(vec2(period, height))
      const b = vec2(lattice[bx], lattice[by]).mul(vec2(period, height))
      const ba = b.sub(a)
      const pa = at.sub(a)
      const t = pa.dot(ba).div(ba.dot(ba)).clamp(0, 1)
      const drawn = hash(id.mul(17).add(index)).lessThan(chance)
      distance = min(distance, drawn.select(pa.sub(ba.mul(t)).length(), float(1)))
    }
    const stroke = line(distance, 0.0011)
    const halo = distance.div(-0.0035).exp()
    // Flaring one after another along the member, each smoldering with a flicker of its own between.
    const flare = time.mul(1.3).sub(cell.mul(0.6)).sub(surface.member.mul(2.1)).sin().mul(0.5).add(0.5).pow(10)
    const smolder = mx_noise_float(vec3(time.mul(2.3), id.mul(0.37), 0.5)).mul(0.15).add(0.3)
    const light = flare.mul(0.9).add(smolder)
    const cracks = mx_worley_noise_float(p.mul(260)).smoothstep(0.08, 0).mul(visibleDetail(footprint, 0.003))
    const char = mix(color('#0b0807'), color('#231a14'), mx_noise_float(p.mul(120)).mul(0.5).add(0.5))
    this.colorNode = mix(mix(char, color('#040302'), halo.mul(0.8)), color('#bfffdc'), stroke.mul(0.5))
    this.emissiveNode = color('#3fd98a').mul(stroke.mul(light).mul(4).add(halo.mul(light).mul(0.6)).add(cracks.mul(0.25).mul(smolder)))
    this.normalNode = heightNormal(stroke.mul(-0.0004).add(mx_noise_float(p.mul(300)).mul(0.00004).mul(visibleDetail(footprint, 0.003))))
  }
}
/**
 * A crystal ball: dark, flawless glass, green mist swirling inside it and glowing deepest in its middle, a bright rim where it turns away and the room mirrored on it.
 */
class CrystalMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.03,
      envMap: frameStudio,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    })
    const surface = frameSurface()
    // In units of the ball’s radius, its middle at 0, as the viewer sees it.
    const q = vec2(surface.along, surface.across).div(ball.radius)
    const depth = float(1).sub(q.dot(q)).max(0).sqrt()
    const spin = time.mul(0.35)
    const swirled = vec2(q.x.mul(spin.cos()).sub(q.y.mul(spin.sin())), q.x.mul(spin.sin()).add(q.y.mul(spin.cos())))
    const mist = mx_noise_float(vec3(swirled.mul(2.6), time.mul(0.25))).mul(0.5).add(0.5).mul(mx_noise_float(vec3(swirled.mul(5.2).add(3.1), time.mul(0.4))).mul(0.3).add(0.7))
    const swirl = mist.smoothstep(0.35, 0.85).mul(depth)
    const facing = normalView.dot(positionViewDirection.negate()).abs().clamp(0, 1)
    const rim = facing.oneMinus().pow(3)
    const breath = time.mul(0.8).sin().mul(0.2).add(1)
    this.colorNode = mix(color('#030806'), color('#1f6a46'), swirl.mul(0.5))
    this.emissiveNode = color('#3fd98a').mul(swirl.mul(2.4).mul(breath).add(rim.mul(0.5)))
  }
}
