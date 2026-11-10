import type {Node} from 'three/webgpu'

import {color, float, mix, mx_noise_float, mx_worley_noise_float, normalView, positionViewDirection, time, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface, viewBelow} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.058
const obsidian = 0
const pool = 1
/** the pool of portal fluid between the two obsidian rims: where it runs and the level it lies at */
const surfaceOf = {
  from: 0.016,
  to: 0.084,
  z: -0.044,
}
/** an obsidian bead at the sight edge, the pool level between it and an obsidian torus, and a cove to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], obsidian)
  .line(-0.005, -0.046)
  .arc(surfaceOf.from, surfaceOf.z, 0.5, {steps: 8})
  .line(surfaceOf.to, surfaceOf.z, {material: pool})
  .arc(0.106, surfaceOf.z, 0.5, {
    steps: 10,
    material: obsidian,
  })
  .arc(0.12, -0.072, -0.2, {steps: 6})
  .line(0.12, frameBack)
  .line(-0.005, frameBack)
/** how far out past the opening the middle of the pool lies */
const middle = (surfaceOf.from + surfaceOf.to) / 2
/**
 * The currents in the pool, ever deeper below its surface and further than the frame is deep, as the portal’s other side is: how fast each runs round the work, the ones above and below it the other way, how fine its filaments are, how bright it shines and its color.
 * The two deepest also carry motes of light.
 */
const currents = [{
  depth: 0.012,
  speed: 0.028,
  fineness: 34,
  light: 0.75,
  tint: '#8affc8',
}, {
  depth: 0.03,
  speed: -0.02,
  fineness: 27,
  light: 0.8,
  tint: '#3fd98a',
}, {
  depth: 0.06,
  speed: 0.014,
  fineness: 21,
  light: 0.65,
  tint: '#22b07a',
}, {
  depth: 0.1,
  speed: -0.009,
  fineness: 16,
  light: 0.55,
  tint: '#178a86',
}, {
  depth: 0.17,
  speed: 0.005,
  fineness: 12,
  light: 0.5,
  tint: '#3a3a9a',
}] as const
/** the ripples running across the pool, out and in: their wavelengths in meters, how fast they run in meters a second, and how high they are */
const ripples = [{
  length: 0.018,
  speed: 0.04,
  height: 0.00012,
}, {
  length: 0.027,
  speed: -0.026,
  height: 0.0001,
}] as const

/** One of the Spook Orb’s frames, an abyss: a pool of clear, dark portal fluid between two obsidian rims, through whose rippling surface currents of light show ever deeper, running round the work against each other. */
export default class AbyssFrame extends PortraitFrame {
  override readonly description = 'A window onto the other side: a still pool of dark, clear portal fluid held round the work between two rims of polished obsidian, whose surface ripples back and forth while, far deeper than the frame could be, currents of green light and drifting motes stream round the work, one over the other and each against the next, sliding and bending with every step and every ripple.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#0a2a1e'
  override readonly title = 'Ectoplasm abyss'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new ObsidianMaterial, new AbyssMaterial]
  }
}

/** Polished obsidian, black volcanic glass with faint conchoidal ripples, lit green along its edges by the pool it holds. */
class ObsidianMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.08,
      envMap: frameStudio,
      envMapIntensity: 1.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth())
    const shells = mx_noise_float(p.mul(140)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.004))
    const toPool = surface.reach.sub(surfaceOf.from).abs().min(surface.reach.sub(surfaceOf.to).abs())
    const spill = toPool.div(-0.004).exp().mul(time.mul(0.9).sin().mul(0.15).add(0.85))
    this.colorNode = mix(color('#040506'), color('#0c1012'), shells.mul(0.4))
    this.emissiveNode = color('#2fbf74').mul(spill.mul(0.5))
    this.normalNode = heightNormal(shells.mul(0.00008))
  }
}
/**
 * The pool: a dark, glassy surface, mirroring the room, rippling with waves that run across it out and in. Through it, ever deeper, currents of glowing filaments run round the work, every one the other way from those above and below it and dimmer and bluer the deeper it lies; they slide against each other as the viewer moves and bend where the ripples tilt the surface. The deepest two carry drifting motes of light, and the pool’s edges glow where it meets the obsidian.
 */
class AbyssMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.02,
      envMap: frameStudio,
      envMapIntensity: 1.2,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
    })
    const surface = frameSurface()
    const below = viewBelow(surface)
    const loop = surface.opening.x.add(surface.opening.y).add(middle * 2).mul(4)
    const here = aroundOpening(surface.position.xy, surface.opening)
    const ring = aroundLoop(here.distance, here.perimeter, loop)
    // The ripples, wavering along the pool; how steep they are tilts what lies below across the pool.
    const waver = mx_noise_float(vec3(ring.mul(30), time.mul(0.3))).mul(2).toVar('abyssWaver')
    let height: Float = float(0)
    let slope: Float = float(0)
    for (const [index, {length, speed, height: crest}] of ripples.entries()) {
      const phase = here.reach.sub(time.mul(speed)).mul(Math.PI * 2 / length).add(waver.mul(index === 0 ? 1 : -0.7))
      height = height.add(phase.sin().mul(crest))
      slope = slope.add(phase.cos().mul(crest * Math.PI * 2 / length))
    }
    const chop = mx_noise_float(vec3(ring.mul(90), here.reach.mul(90)).add(vec3(time.mul(0.3), time.mul(-0.2), time.mul(0.5)))).mul(0.00004)
    let light: Vec3 = vec3(0)
    for (const [index, {depth, speed, fineness, light: strength, tint}] of currents.entries()) {
      const at = aroundOpening(below(depth).xy, surface.opening)
      const reach = at.reach.add(slope.mul(depth * 1.5))
      const point = vec3(aroundLoop(at.distance.sub(time.mul(speed)), at.perimeter, loop), reach).mul(fineness).add(vec3(index * 7.3, index * 3.1, time.mul(0.1)))
      const warp = mx_noise_float(point.mul(0.45).add(vec3(0, 0, time.mul(0.15)))).mul(1.2)
      const filament = float(1).sub(mx_noise_float(point.add(vec3(warp, warp.mul(-0.6), 0))).abs().mul(4)).max(0).pow(2.5)
      const motes = index >= currents.length - 2 ? mx_worley_noise_float(point.mul(1.7)).smoothstep(0.12, 0.02).mul(mx_noise_float(point.mul(0.3).add(vec3(0, 0, time.mul(0.7)))).smoothstep(0, 0.4)) : float(0)
      // Every current fades out toward the pool’s edges, where the obsidian lies over it.
      const banks = reach.smoothstep(surfaceOf.from - 0.004, surfaceOf.from + 0.012).mul(reach.smoothstep(surfaceOf.to + 0.004, surfaceOf.to - 0.012))
      light = light.add(color(tint).mul(filament.add(motes.mul(1.5)).mul(strength).mul(banks)))
    }
    // The surface mirrors the room at a grazing view and shows less of what lies below.
    const facing = normalView.dot(positionViewDirection.negate()).abs().clamp(0, 1)
    const edges = here.reach.sub(surfaceOf.from).min(float(surfaceOf.to).sub(here.reach)).div(-0.0025).exp()
    const breath = time.mul(0.6).sin().mul(0.12).add(1)
    this.colorNode = color('#010604')
    this.emissiveNode = light.add(color('#03160d')).mul(facing.pow(0.5)).mul(breath).add(color('#8affc8').mul(edges.mul(0.8)))
    this.normalNode = heightNormal(height.add(chop))
  }
}
