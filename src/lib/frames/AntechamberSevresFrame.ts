import type {FrameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {atan, clamp, color, float, max, min, mix, mx_noise_float, mx_worley_noise_vec2, select, smoothstep, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {legible} from '#src/lib/materials/frames/carving.ts'
import {fittedPeriod} from '#src/lib/materials/frames/frameAttributes.ts'
import {backSurface, hangingWire} from '#src/lib/materials/frames/frameBacks.ts'
import FramePaintMaterial, {layerGold} from '#src/lib/materials/frames/FramePaintMaterial.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'
import GiltMaterial from '#src/lib/materials/frames/GiltMaterial.ts'
import {circle, leaf} from '#src/lib/materials/sdf.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {withOpening} from './frameBack.ts'
import {assembleFrame, corners, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {relief} from './ornaments.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

const imageDepth = -0.056
/** the material of the back */
const back = 2
const gilt = 0
const porcelain = 1
/** the swelling cushion of glazed porcelain the reserves are painted on */
const cushion = {
  from: 0.008,
  to: 0.078,
  z: -0.05,
}
const middle = (cushion.from + cushion.to) / 2
/** a gilt bead at the sight edge, a broad swelling cushion of porcelain, a gilt fillet, a porcelain cove and a gilt bead at the outer edge */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.048)
  .arc(0.006, -0.048, 0.5, {steps: 6})
  .line(cushion.from, cushion.z, {material: porcelain})
  .arc(cushion.to, cushion.z, 0.16, {steps: 14})
  .line(0.08, -0.046, {material: gilt})
  .line(0.085, -0.046)
  .arc(0.1, -0.062, -0.3, {
    steps: 6,
    material: porcelain,
  })
  .arc(0.108, -0.07, 0.5, {
    steps: 6,
    material: gilt,
  })
  .line(0.108, frameBack)
  .line(-0.005, frameBack, {material: back})
/** where the ormolu mounts’ backs lie, sunk into the cushion’s crest, and how far they stand out from there */
const mount = {
  back: -0.042,
  depth: 0.01,
}
/** half the reserves’ height across the cushion */
const reserveHeight = 0.026
/** An ormolu palmette for the corners, a fan of five lobes spreading up the diagonal from a round foot, as points counterclockwise. */
function palmette() {
  const count = 20
  return Array.from({length: count}, (_, index): readonly [number, number] => {
    const angle = index / count * Math.PI * 2
    const toward = Math.cos(angle - Math.PI / 4)
    const lobes = Math.abs(Math.cos((angle - Math.PI / 4) * 2.5))
    const radius = 0.011 + 0.018 * Math.max(0, toward) ** 1.4 * (0.72 + 0.28 * lobes)
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })
}
/** A rose painted in the reserve: petals swirling into a deep heart, as a share of it 0 to 1 and its color. */
function rose(p: Vec2, center: readonly [number, number], radius: number) {
  const offset = p.sub(vec2(...center))
  const distance = offset.length()
  const s = distance.div(radius)
  const swirl = atan(offset.y, offset.x).mul(3).add(s.mul(9)).sin().mul(0.5).add(0.5)
  const shade = clamp(s.mul(0.7).add(swirl.mul(0.45)).sub(0.15), 0, 1)
  return {
    mask: inside(circle(p, center, radius)),
    color: mix(vec3(0.42, 0.04, 0.1), vec3(0.93, 0.5, 0.6), shade),
  }
}
/** Where the point lies in the nearest reserve, in meters from its middle along and across the cushion, and how far outside its edge, negative inside. */
function reserve(surface: FrameSurface) {
  const period = fittedPeriod(surface.openingHalf, 0.26, middle, true)
  const q = surface.along.div(period)
  const x = q.sub(q.round()).mul(period)
  const y = surface.reach.sub(middle)
  const halfLength = min(period.mul(0.33), float(0.085))
  const edge = vec2(x.div(halfLength), y.div(reserveHeight)).length().sub(1).mul(reserveHeight)
  return {
    p: vec2(x, y),
    edge,
  }
}
/** The bouquet painted in a reserve: three roses and two buds among leaves, with forget-me-nots, over the white, at `p` meters from the reserve’s middle. */
function bouquet(p: Vec2) {
  let painted: Node<'vec3'> = vec3(0.95, 0.94, 0.9)
  const leaves = [
    [[-0.01, -0.012], 0.009, 0.0032, -2.4],
    [[0.011, 0.013], 0.009, 0.0032, 0.8],
    [[-0.029, 0.009], 0.008, 0.0028, 2.6],
    [[0.028, -0.012], 0.008, 0.0028, -0.5],
    [[0.006, -0.015], 0.007, 0.0025, -1.3],
    [[-0.02, 0.014], 0.006, 0.0022, 1.9],
  ] as const
  const leafMask = leaves.reduce<Float>((mask, [center, length, width, angle]) => max(mask, inside(leaf(p, center, length, width, angle))), float(0))
  painted = mix(painted, mix(vec3(0.12, 0.3, 0.12), vec3(0.32, 0.5, 0.2), p.y.mul(60).add(0.5).clamp(0, 1)), leafMask)
  for (const center of [[-0.013, 0.012], [0.014, -0.013], [0.041, -0.003], [-0.042, -0.004], [0.035, 0.012]] as const) {
    painted = mix(painted, vec3(0.25, 0.42, 0.85), inside(circle(p, center, 0.0017)))
  }
  for (const [center, radius] of [[[0, 0.002], 0.0088], [[-0.021, -0.004], 0.0066], [[0.02, -0.005], 0.0062], [[0.034, 0.006], 0.0042], [[-0.036, 0.005], 0.0044]] as const) {
    const flower = rose(p, center, radius)
    painted = mix(painted, flower.color, flower.mask)
  }
  return painted
}

/** The Antechamber’s: Sèvres porcelain in bleu céleste, white reserves painted with roses, a gilt pebbling over the ground and ormolu palmettes on the corners. */
export default class AntechamberSevresFrame extends PortraitFrame {
  override readonly description = 'Sèvres porcelain for an audience that keeps you waiting: a swelling cushion glazed in bleu céleste, set with white reserves in gilt rims painted with bouquets of roses and forget-me-nots, the ground between them gilt in a fine caillouté of pebbles, an ormolu palmette spreading over every corner, between gilt beads. Its back is the porcelain left in the biscuit, painted in underglaze blue with the factory’s two interlaced Ls round a date letter and the painter’s mark.'
  override readonly front = Math.max(profile.front, mount.back + mount.depth)
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#5fb4c2'
  override readonly title = 'Sèvres bleu céleste'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    return assembleFrame([
      ...withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight),
      [gilt, place(relief(palmette(), mount.depth, {
        bevel: 0.002,
        kind: 1,
      }), corners(halfWidth, halfHeight, middle, mount.back))],
    ])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.06,
        grime: 0.35,
        relief: {
          depth: 0.0015,
          height: surface => {
            // The palmettes’ ribs fan out from their foot.
            const p = vec2(surface.along, surface.across)
            const ribs = atan(p.y, p.x).mul(16).cos().mul(0.5).add(0.5).mul(smoothstep(0.005, 0.009, p.length()))
            return select(surface.isOrnament.greaterThan(0.5), legible(surface, ribs, 0.004).mul(0.0015), float(0))
          },
        },
      }),
      new FramePaintMaterial({
        color: '#4fb0c0',
        roughness: 0.28,
        clearcoat: 1,
        grime: 0.12,
        layers: surface => {
          const p = surface.position
          const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
          const onCushion = select(surface.reach.lessThan(cushion.to + 0.001), float(1), float(0))
          const {p: local, edge} = reserve(surface)
          const white = inside(edge).mul(onCushion)
          const rim = line(edge.sub(0.0004), 0.0011).add(line(edge.sub(0.0038), 0.0004).mul(0.8)).mul(onCushion).clamp(0, 1)
          // Up close the bouquet, from afar its average, a pale rose over the white.
          const painted = mix(vec3(0.86, 0.74, 0.74), bouquet(local), visibleDetail(footprint, 0.004))
          // Caillouté: a network of gilt lines round irregular pebbles over the ground, fading to its average from afar.
          const pebbles = mx_worley_noise_vec2(vec3(surface.along.mul(240), surface.reach.add(p.z).mul(240), surface.member.mul(3.1)))
          const network = line(pebbles.y.sub(pebbles.x), 0.07).mul(visibleDetail(footprint, 0.0015)).add(visibleDetail(footprint, 0.0015).oneMinus().mul(0.25))
          const clear = select(edge.greaterThan(0.005), float(1), float(0)).max(onCushion.oneMinus())
          const ground = network.mul(white.oneMinus()).mul(clear)
          return [
            {
              mask: ground.mul(0.8),
              color: layerGold,
              metalness: 1,
              roughness: 0.25,
            },
            {
              mask: white,
              color: painted,
              roughness: 0.22,
            },
            {
              mask: rim,
              color: layerGold,
              metalness: 1,
              roughness: 0.2,
              height: rim.mul(0.00012),
            },
          ]
        },
      }),
      new SevresBackMaterial,
    ]
  }
}
/** The back: the porcelain left in the biscuit, matte and faintly gritty, the factory’s mark of two interlaced Ls round a date letter painted on it in underglaze blue with the painter’s mark beside it, and the hanging wire across it. */
class SevresBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.5,
      roughness: 0.75,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const grit = mx_noise_float(vec3(point.mul(900), 3.3)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0012))
    const biscuit = mix(color('#e6e2d8'), color('#f3f0e8'), mx_noise_float(vec3(point.mul(8), 1.1)).mul(0.5).add(0.5))
    // Two Ls back to back, each a stroke curving round, crossing above and below a date letter, an A, between them.
    const at = point.sub(vec2(0, opening.y.mul(-0.35)))
    const radius = 0.034
    const left = line(at.sub(vec2(-0.015, 0)).length().sub(radius), 0.0022).mul(select(at.x.greaterThan(-0.015), float(1), float(0)))
    const right = line(at.sub(vec2(0.015, 0)).length().sub(radius), 0.0022).mul(select(at.x.lessThan(0.015), float(1), float(0)))
    const legs = line(at.x.abs().sub(at.y.negate().add(0.009).mul(0.4)), 0.0011).mul(select(at.y.abs().lessThan(0.009), float(1), float(0)))
    const bar = line(at.y.add(0.0018), 0.0011).mul(select(at.x.abs().lessThan(0.0036), float(1), float(0)))
    const painter = inside(at.sub(vec2(0.06, -0.026)).length().sub(0.003)).max(inside(at.sub(vec2(0.07, -0.026)).length().sub(0.003))).max(inside(at.sub(vec2(0.065, -0.017)).length().sub(0.003)))
    const mark = left.max(right).max(legs).max(bar).max(painter).clamp(0, 1)
    const hanger = hangingWire(surface)
    this.colorNode = mix(mix(biscuit.mul(grit.mul(0.06).add(0.97)), color('#2c4c9c'), mark.mul(0.9)), hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.78), float(0.5), mark), float(0.35), hanger.cover)
    this.normalNode = heightNormal(grit.mul(0.00003).add(hanger.height))
  }
}
