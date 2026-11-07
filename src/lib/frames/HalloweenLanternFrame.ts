import type {Node} from 'three/webgpu'

import {color, float, max, min, mix, mx_noise_float, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from '#src/lib/materials/filters.ts'
import {frameSurface, fromCorner} from '#src/lib/materials/frames/frameAttributes.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

const imageDepth = -0.06
const flesh = 0
const rind = 1
/** the pale flesh the knife bared at the sight edge, then three swelling lobes of rind with deep creases between them, the last rolling round to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], flesh)
  .line(-0.005, -0.05)
  .line(0.008, -0.04)
  .arc(0.044, -0.04, 0.3, {
    steps: 8,
    material: rind,
  })
  .arc(0.084, -0.04, 0.3, {steps: 8})
  .arc(0.118, -0.066, 0.38, {steps: 8})
  .line(0.12, frameBack)
  .line(-0.005, frameBack)
/** how far out past the opening the faces are carved on every corner, and half their width */
const faceReach = 0.06
const faceSize = 0.064
/** The signed distance, in units of the face, to a triangle round (`x`, `y`) pointing up, or down, whose inscribed circle has the radius `size`. */
function triangle(q: Vec2, x: number, y: number, size: number, down = false): Float {
  const d = q.sub(vec2(x, y)).mul(vec2(1, down ? -1 : 1))
  return max(max(d.x.mul(0.866).add(d.y.mul(0.5)), d.x.mul(-0.866).add(d.y.mul(0.5))), d.y.negate()).sub(size)
}
/** The signed distance, in units of the face, to what is cut out of a jack-o’-lantern: two slanting triangle eyes, a triangle nose and a wide grin with three square teeth left standing. */
function carving(q: Vec2): Float {
  const mirrored = vec2(q.x.abs(), q.y)
  const eye = triangle(mirrored, 0.4, 0.3, 0.15)
  const nose = triangle(q, 0, 0.02, 0.08)
  const top = q.x.mul(q.x).mul(0.4).sub(0.24)
  const bottom = q.x.mul(q.x).mul(0.8).sub(0.62)
  const grin = max(max(q.y.sub(top), bottom.sub(q.y)), q.x.abs().sub(0.78))
  // The teeth the knife went round: two hanging from the upper lip, one standing on the lower.
  const upper = max(mirrored.x.sub(0.3).abs().sub(0.08), top.sub(0.15).sub(q.y))
  const lower = max(q.x.abs().sub(0.08), q.y.sub(bottom.add(0.15)))
  return min(min(eye, nose), max(grin, min(upper, lower).negate()))
}

/** One of the Halloween Orb’s frames: a jack-o’-lantern, its rind swelling in lobes round the work, a grinning face carved on every corner and lit by a guttering candle inside. */
export default class HalloweenLanternFrame extends PortraitFrame {
  override readonly description = 'Carved out of the biggest pumpkin of the patch: lobes of waxy orange rind swelling round the work between deep creases, and a grinning jack-o’-lantern face cut on every corner, glowing with a guttering candle inside.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#e8741c'
  override readonly title = 'Jack-o’-lantern'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FleshMaterial, new RindMaterial]
  }
}

/** The pumpkin’s flesh where the knife cut through it: pale, fibrous and moist. */
class FleshMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.38,
      envMap: frameStudio,
      envMapIntensity: 0.6,
      sheen: 0.4,
      sheenColor: '#ffd28a',
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const fibers = mx_noise_float(vec3(surface.along.mul(30), surface.across.mul(700), surface.member)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.002))
    this.colorNode = mix(color('#e9a540'), color('#f8cf72'), fibers.mul(0.6).add(mx_noise_float(p.mul(60)).mul(0.2)))
    this.normalNode = heightNormal(fibers.mul(0.00005))
  }
}
/**
 * Pumpkin rind: waxy orange, paler on the swelling lobes and dark in the creases between them, streaked lengthwise and freckled. On every corner a face is cut clean through it, which a candle inside lights, flickering and guttering, its glow showing through the thin rind round the cuts, where the pale flesh shows on the cut walls.
 */
class RindMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.9,
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('rindFootprint')
    // Pale scars here and there where the pumpkin scraped the ground, and the fine pebbling of its skin.
    const scars = mx_noise_float(p.mul(22).add(vec3(2.7, 0, 0))).smoothstep(0.45, 0.62).mul(mx_noise_float(p.mul(180)).mul(0.5).add(0.5))
    const pebbles = mx_noise_float(p.mul(420)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.003))
    const lobe = surface.cavity.mul(-1).smoothstep(0, 0.8)
    const crease = surface.cavity.smoothstep(0.1, 0.9)
    const blotches = mx_noise_float(p.mul(9).add(surface.piece.mul(4))).mul(0.5).add(0.5)
    const flush = mx_noise_float(p.mul(30)).mul(0.5).add(0.5)
    const freckles = mx_noise_float(p.mul(700)).smoothstep(0.55, 0.8).mul(visibleDetail(footprint, 0.002))
    const veining = mx_noise_float(vec3(surface.along.mul(3), surface.across.mul(90), surface.member)).mul(0.5).add(0.5)
    const orange = mix(color('#9a3606'), color('#f08424'), lobe.mul(0.5).add(blotches.mul(0.45)).add(flush.mul(0.12)).sub(veining.mul(0.15)))
    const skin = mix(mix(mix(orange, color('#3e1804'), crease.mul(0.85)), color('#f2b45a'), freckles.mul(0.45)), color('#8a7a42'), scars.mul(0.55))
    // The face on the nearest corner, and the candle behind it, which flickers on its own in every corner.
    const d = carving(fromCorner(surface, faceReach).div(faceSize)).mul(faceSize).toVar('rindCut')
    const corner = p.xy.sign()
    const seed = corner.x.mul(1.7).add(corner.y.mul(3.1))
    const flame = mx_noise_float(vec3(time.mul(7), seed, 0)).mul(0.22).add(mx_noise_float(vec3(time.mul(1.9), seed, 4)).mul(0.18)).add(1).toVar('rindFlame')
    const hole = inside(d).toVar('rindHole')
    const wall = inside(d.sub(0.0025)).sub(hole).max(0)
    const halo = max(d, float(0)).div(-0.012).exp().mul(hole.oneMinus())
    // Deep inside, the lit far wall of the pumpkin, hottest in the middle of every cut.
    const depth = d.negate().smoothstep(0, 0.012)
    const candle = mix(color('#ff5a00'), color('#ffbb3a'), depth)
    this.colorNode = mix(mix(skin, color('#f3bb5c'), wall), vec3(0.03, 0.01, 0), hole)
    this.emissiveNode = candle.mul(hole.mul(depth.mul(0.7).add(0.3)).mul(10).add(halo.mul(0.9)).add(wall.mul(1.4))).mul(flame)
    this.roughnessNode = float(0.62).sub(lobe.mul(0.14)).add(crease.mul(0.1)).add(wall.mul(0.15)).add(scars.mul(0.2))
    this.normalNode = heightNormal(pebbles.mul(0.00003).add(freckles.mul(0.00002)).add(scars.mul(0.0001)).add(blotches.mul(0.0006)).sub(inside(d.sub(0.0015)).mul(0.0015)))
  }
}
