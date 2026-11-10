import type {Node} from 'three/webgpu'

import {color, float, hash, mix, mx_fractal_noise_float, mx_noise_float, normalView, positionViewDirection, time, uv, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface, viewBelow} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import {turned} from '../lib/ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.058
const fluid = 0
const tear = 1
/** the rift splitting the fluid all round the work: where its lips are and how deep its floor lies */
const rift = {
  from: 0.043,
  to: 0.071,
  floor: -0.068,
}
/** the middle of the rift, which the fluid wells out of */
const riftMiddle = (rift.from + rift.to) / 2
/** a soft lip at the sight edge, a swollen lobe of fluid, the rift between it and a second lobe, which rolls down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], fluid)
  .line(-0.005, -0.05)
  .arc(0.028, -0.03, 0.32, {steps: 10})
  .arc(rift.from, -0.04, 0.25, {steps: 5})
  .line(riftMiddle, rift.floor, {material: tear})
  .line(rift.to, -0.04)
  .arc(0.092, -0.03, 0.25, {
    steps: 5,
    material: fluid,
  })
  .arc(0.116, -0.072, 0.34, {steps: 10})
  .line(0.116, frameBack)
  .line(-0.005, frameBack)
/** how fast the fluid wells out of the rift, in meters a second, how far apart the ripples it sends out run and how fast they go */
const flow = {
  speed: 0.012,
  ripple: 0.011,
  rippleSpeed: 0.02,
}
/** how far behind the rift’s lips the light on the other side lies */
const beyond = 0.06
/** the bubbles welling up in the fluid: the cells they rise in, how many cells hold one and how many seconds one takes from rising to bursting, at least and at most */
const bubbles = {
  cell: 0.02,
  share: 0.3,
  life: [3, 7],
}
/** the drips hanging off the bottom: how far out and forward they leave the fluid, how far apart they hang and how many there are at most */
const drips = {
  r: 0.082,
  z: -0.046,
  spacing: 0.08,
  most: 9,
}
/** the short drips hanging off the sight edge over the top of the work: how far forward they leave it and how many there are at most */
const sightDrips = {
  z: -0.052,
  most: 5,
}
/** a repeatable scatter: a value from 0 to 1 for the drip and the property */
const scatter = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453
  return value - Math.floor(value)
}
/** A drip, which leaves the fluid thick, thins to a neck and swells into a drop at its end; its own v runs along it. */
const drip = () => turned([[0.0175, 0], [0.015, 0.01], [0.0095, 0.024], [0.0056, 0.036], [0.0062, 0.044], [0.0106, 0.051], [0.01, 0.059], [0, 0.065]], 7, {
  kind: 1,
  ownUv: true,
})
/** How far, in meters either side of its middle, the breathing rift is open where it runs: from about a third to all of its width, changing along it and over time, its edges torn jagged. */
function parting(around: Node<'vec2'>): Float {
  const breadth = mx_noise_float(vec3(around.mul(9), time.mul(0.35))).mul(0.5).add(0.5).mul(0.7).add(0.3).mul(time.mul(1.7).sin().mul(0.08).add(0.92))
  const torn = mx_noise_float(vec3(around.mul(160), time.mul(0.4))).mul(0.0022)
  return breadth.mul((rift.to - rift.from) / 2).add(torn).max(0)
}

/** One of the Spook Orb’s frames, a rift: portal fluid welling out of a glowing tear that runs all round the work, rippling, bubbling and dripping. */
export default class RiftFrame extends PortraitFrame {
  override readonly description = 'A tear into the other side runs all round the work, splitting a swollen frame of ectoplasm: through it a churning white-green light shows deep below, the tear breathing open and shut, while glowing fluid wells out of it and creeps away over both lobes in slow ripples, bubbles rising and bursting in it, until it overflows and drips off the bottom and over the top of the work.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#3fd98a'
  override readonly title = 'Ectoplasm rift'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const count = Math.min(drips.most, Math.max(2, Math.floor(width / drips.spacing)))
    const spots = Array.from({length: count}, (_, index) => {
      const x = (index + 0.5 + (scatter(index, 1) - 0.5) * 0.6) / count * (width + drips.r) - (width + drips.r) / 2
      // Hanging straight down, each stretched to a length of its own.
      return {
        position: [x, -halfHeight - drips.r, drips.z] as const,
        tilt: Math.PI / 2,
        scale: [1, 1, 0.45 + scatter(index, 2) * 0.55] as const,
      }
    })
    // Over the work, a few short drips hang from the sight edge of the top.
    const over = Math.min(sightDrips.most, Math.max(1, Math.floor(width / 0.25)))
    const sight = Array.from({length: over}, (_, index) => ({
      position: [((index + 0.5 + (scatter(index, 5) - 0.5) * 0.7) / over - 0.5) * width, halfHeight + 0.002, sightDrips.z] as const,
      tilt: Math.PI / 2,
      scale: [0.6, 0.6, 0.35 + scatter(index, 6) * 0.35] as const,
    }))
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [fluid, place(drip(), spots)],
      [fluid, place(drip(), sight)],
    ])
  }

  protected override createMaterials() {
    return [new SeepMaterial, new TearMaterial]
  }
}

/**
 * The fluid welling out of the rift: thick, glossy ectoplasm glowing brightest by the rift and fading as it creeps away from it over both lobes, in smoky swirls and ripples running outward, without a seam through the miters. A layer deeper down creeps after the surface, sliding under it as the viewer moves. Bubbles rise in it here and there, swell and burst in a flash; in the drips, the glow runs down toward their drops and swells there.
 */
class SeepMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.07,
      envMap: frameStudio,
      envMapIntensity: 0.6,
      clearcoat: 0.8,
      clearcoatRoughness: 0.03,
    })
    const surface = frameSurface()
    const p = surface.position
    const isDrip = surface.isOrnament
    const below = viewBelow(surface)
    const loop = surface.opening.x.add(surface.opening.y).add(riftMiddle * 2).mul(4)
    /** Where noise is sampled for the fluid `depth` meters down, welling away from the rift at `speed`: round a loop in x and y, away from the rift in z, in meters, and how far from the rift it lies. */
    const seeping = (depth: number, speed: number) => {
      const at = aroundOpening(below(depth).xy, surface.opening)
      const away = at.reach.sub(riftMiddle).abs()
      return {
        point: vec3(aroundLoop(at.distance, at.perimeter, loop), away.sub(time.mul(speed))),
        away,
        at,
      }
    }
    const {point: top, away, at} = seeping(0, flow.speed)
    const warp = vec3(mx_noise_float(top.mul(22).add(vec3(0, 0, 3.1))), mx_noise_float(top.mul(22).add(vec3(4.7, 0, 0))), 0).mul(0.01)
    const smoke = mx_fractal_noise_float(top.add(warp).mul(vec3(30, 30, 55)), 3).mul(0.5).add(0.5).toVar('seepSmoke')
    const {point: under} = seeping(0.016, flow.speed * 0.5)
    const strands = float(1).sub(mx_noise_float(under.add(warp.mul(2)).mul(vec3(26, 26, 44)).add(vec3(0, 0, time.mul(0.05)))).abs().mul(5)).max(0).pow(3)
    // Brightest where it has just welled out, flaring where the rift beside it opens wide.
    const ring = aroundLoop(at.distance, at.perimeter, loop)
    const fresh = away.sub(parting(ring)).max(0).div(-0.007).exp().toVar('seepFresh')
    // Ripples running out from the rift, wavering and dying away.
    const waves = away.sub(time.mul(flow.rippleSpeed)).div(flow.ripple).add(mx_noise_float(vec3(ring.mul(20), time.mul(0.2)))).mul(Math.PI * 2).sin().mul(away.div(-0.03).exp())
    // A bubble in some cells, rising, swelling and bursting at a moment of its own, then rising afresh; the cell where the loop closes on itself has none, so none is cut in two.
    const cell = vec2(at.distance, at.reach).div(bubbles.cell).floor()
    const id = cell.x.mul(127.1).add(cell.y.mul(311.7))
    const life = hash(id.add(1)).mul(bubbles.life[1] - bubbles.life[0]).add(bubbles.life[0])
    const age = time.div(life).add(hash(id.add(2))).fract()
    const middle = cell.add(vec2(hash(id.add(3)), hash(id.add(4))).mul(0.4).add(0.3)).mul(bubbles.cell)
    const radius = age.sqrt().mul(bubbles.cell * 0.34)
    const within = vec2(at.distance, at.reach).sub(middle).length()
    const kept = hash(id).lessThan(bubbles.share).and(cell.x.lessThan(at.perimeter.div(bubbles.cell).floor().sub(0.5))).and(middle.y.sub(riftMiddle).abs().greaterThan(0.024)).and(isDrip.lessThan(0.5))
    const living = kept.select(age.smoothstep(0, 0.1).mul(age.smoothstep(0.94, 0.9)), float(0))
    // A bubble is a thin film over the fluid, bright along its rim, where the light runs through most of it.
    const bubble = inside(within.sub(radius)).mul(living).toVar('seepBubble')
    const film = within.sub(radius).abs().div(-0.0007).exp().mul(living).add(bubble.mul(0.25))
    const dome = radius.mul(radius).sub(within.mul(within)).max(0).sqrt().mul(living)
    const burst = kept.select(age.smoothstep(0.9, 0.94).mul(age.smoothstep(1, 0.95)), float(0)).mul(within.sub(radius.mul(age.sub(0.9).mul(20).add(1))).abs().div(-0.0008).exp())
    // In the drips, the glow runs down toward their drops and swells there.
    const drop: Float = isDrip.mul(uv().y.smoothstep(0.55, 0.85))
    const trickle = isDrip.mul(uv().y.mul(18).sub(time.mul(1.2)).sin().mul(0.5).add(0.5))
    const facing = normalView.dot(positionViewDirection.negate()).abs().clamp(0, 1)
    const sheen = facing.oneMinus().pow(2)
    const throb = time.mul(0.9).sin().mul(0.1).add(1)
    const smoky = smoke.smoothstep(0.3, 0.85)
    const light = smoky.mul(0.2).add(strands.mul(0.3)).add(fresh.mul(2.2)).add(sheen.mul(0.4)).add(film.mul(1.2)).add(drop.mul(0.9)).add(trickle.mul(0.25)).add(0.04)
    this.colorNode = mix(color('#010d07'), color('#0c4a2c'), smoky.mul(0.4).add(fresh.mul(0.4)))
    this.emissiveNode = mix(color('#2fbf74'), color('#d4ffe8'), fresh.mul(0.35).max(strands.mul(0.4)).max(film.mul(0.6))).mul(light.mul(throb)).add(color('#e8fff2').mul(burst.mul(3)))
    this.normalNode = heightNormal(smoke.mul(0.0006).add(waves.mul(0.00025)).add(dome.mul(0.6)).add(mx_noise_float(p.mul(26)).mul(0.0015)))
  }
}
/**
 * The tear itself: down between its lips, the light of the other side shows through where it is open, a churning white-green blaze far below that slides as the viewer moves and flickers as it breathes open and shut; where it has closed, the fluid of its lips meets in a dark seam.
 */
class TearMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.1,
      envMap: frameStudio,
      envMapIntensity: 0.5,
    })
    const surface = frameSurface()
    const below = viewBelow(surface)
    const loop = surface.opening.x.add(surface.opening.y).add(riftMiddle * 2).mul(4)
    const here = aroundOpening(surface.position.xy, surface.opening)
    const ring = aroundLoop(here.distance, here.perimeter, loop)
    const half = (rift.to - rift.from) / 2
    const edge = here.reach.sub(riftMiddle).abs().sub(parting(ring)).toVar('tearEdge')
    const open = inside(edge)
    // The torn edge burns white-hot.
    const seam = edge.abs().div(-0.0009).exp()
    // The other side, far below the lips, racing round the work and churning.
    const far = aroundOpening(below(beyond).xy, surface.opening)
    const churn = mx_fractal_noise_float(vec3(aroundLoop(far.distance.sub(time.mul(0.08)), far.perimeter, loop).mul(40), far.reach.mul(60).add(time.mul(0.6))), 3).mul(0.5).add(0.5)
    const flicker = mx_noise_float(vec3(ring.mul(4), time.mul(6))).mul(0.25).add(1)
    const blaze = mix(color('#2fbf74'), color('#f2fff8'), churn.smoothstep(0.55, 0.9)).mul(churn.smoothstep(0.2, 0.6).mul(0.7).add(0.3))
    const lips = here.reach.sub(riftMiddle).abs().div(half).clamp(0, 1)
    this.colorNode = mix(color('#0a3a22'), color('#020d07'), open.oneMinus())
    this.emissiveNode = blaze.mul(churn.mul(5).add(1.2).mul(flicker).mul(open)).add(color('#b4ffd8').mul(seam.mul(1.6).mul(flicker))).add(color('#2fbf74').mul(lips.mul(0.5).mul(open.oneMinus())))
  }
}
