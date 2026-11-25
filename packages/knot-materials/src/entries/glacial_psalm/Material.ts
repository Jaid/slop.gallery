import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, uv, vec2} from 'three/tsl'

import {buriedUv, reflectedLight} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, resolved, segment, stroke, tiles} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Fold the plane into one of six crystalline sectors, then grow explicit dendritic branches. */
function crystal(tube: Node<'vec2'>, counts: [number, number], seed: number) {
  const {local, random} = tiles(tube, counts, seed)
  const angle = local.y.atan(local.x).add(random.z.mul(TAU))
  const sector = angle.div(TAU / 6).add(0.5).fract().sub(0.5).mul(TAU / 6).abs()
  const r = local.length()
  const p = vec2(r.mul(sector.cos()), r.mul(sector.sin()))
  let distance = segment(p, vec2(0, 0), vec2(0.395, 0))
  for (const x of [0.12, 0.21, 0.3]) {
    const end = vec2(x + 0.048, 0.067 + (0.3 - x) * 0.1)
    distance = distance.min(segment(p, vec2(x, 0), end))
    distance = distance.min(segment(p, end.sub(vec2(0.005, 0.019)), end.add(vec2(-0.026, 0.005))))
  }
  const core = stroke(distance, 0.005)
  const feathers = stroke(distance, 0.017).mul(0.55)
  const growth = exhibitionPhase.add(random.x.mul(TAU)).sin().mul(0.085).add(0.335)
  const active = fill(r.sub(growth))
  const collar = stroke(r.sub(0.072), 0.005).mul(active)
  return {
    core: core.mul(active).max(collar),
    frost: core.max(feathers).mul(active),
    random,
  }
}

/** Dendrites in two refracted layers, frost bloom and tiny silver air inclusions beneath the polish. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const surface = crystal(buriedUv(tube, view, 0.012, 1.31), [12, 2], 59)
    const deep = crystal(buriedUv(tube, view, 0.056, 1.31), [24, 4], 67)
    const cloudy = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const snow = surface.frost.mul(0.95).add(deep.frost.mul(0.3)).clamp()
    const blueIce = mix(color(hsl.integer(237, 67, 25)), color(hsl.integer(228, 38, 58)), cloudy.mul(0.7).add(grazing.mul(0.2)))
    this.colorNode = mix(blueIce, color(hsl.integer(159, 29, 96)), snow.mul(0.86))
    this.metalness = 0
    this.ior = 1.31
    this.roughnessNode = mix(float(0.075), float(0.57), surface.frost)
    this.clearcoatNode = surface.frost.mul(0.7).oneMinus().mul(0.9)
    this.clearcoatRoughness = 0.035
    this.sheenNode = color(hsl.integer(251, 53, 89)).mul(surface.frost).mul(0.22)
    this.sheenRoughness = 0.72
    const bubblesQ = p.sub(normalLocal.mul(0.016)).sub(view.mul(0.023)).mul(90)
    const bubbles = beads(bubblesQ, 17)
    const frostQ = p.mul(310)
    const frostGrain = mx_noise_float(frostQ).mul(resolved(frostQ)).mul(intimate)
    const topHeight = surface.core.mul(0.0007).add(surface.frost.mul(frostGrain.mul(0.0001))).add(bubbles.mask.mul(0.00014))
    this.normalNode = proceduralNormal(topHeight, 1)
    this.clearcoatNormalNode = proceduralNormal(mx_noise_float(p.mul(18)).mul(0.00013), 1)
// Facet tilts use object-space identities; only their images of real room lights move with the eye.
    const microQ = p.mul(130)
    const facetRandom = cellNoiseVec3(microQ.floor()).mul(2).sub(1)
    const normal = normalLocal.normalize()
    const tilt = facetRandom.sub(normal.mul(facetRandom.dot(normal))).mul(0.28)
    const facet = normal.add(tilt).normalize()
    const sparkle = reflectedLight(environment, facet, 0.045).mul(resolved(microQ)).mul(surface.frost).mul(near)
    const breath = exhibitionPhase.add(p.z.mul(8)).sin().mul(0.08).add(0.92)
    this.emissiveNode = color(hsl.integer(241, 100, 92.4)).mul(deep.core).mul(facing).mul(0.24).mul(breath)
      .add(color(hsl.integer(224, 100, 97.4)).mul(surface.core).mul(0.16))
      .add(color(hsl.integer(222, 30, 74)).mul(bubbles.mask).mul(intimate).mul(0.18))
      .add(sparkle.mul(0.13))
  }
}
