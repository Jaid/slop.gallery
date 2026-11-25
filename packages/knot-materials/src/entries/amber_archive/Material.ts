import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** A pressed frond, supported strictly inside its cell so the repeated domain has no cut leaves. */
function fern(point: Node<'vec2'>, footprint: Node<'float'>, sway: Node<'float'>) {
  const y = point.y
  const x = point.x.sub(y.add(0.42).pow2().mul(sway))
  const height = fill(y.abs().sub(0.405), footprint)
  const stem = stroke(x, 0.006, footprint).mul(height)
  const extent = y.add(0.44).mul(1.1).clamp().pow(0.6).mul(y.negate().add(0.43)).mul(0.95)
  const ribs = y.sub(x.abs().mul(0.74)).mul(15)
  const ribDistance = ribs.fract().sub(0.5).abs().div(15)
  const blade = stroke(ribDistance, 0.009, footprint)
    .mul(fill(x.abs().sub(extent), footprint)).mul(height)
  const centralVein = stroke(ribDistance, 0.002, footprint).mul(blade)
  return {
    mask: stem.max(blade),
    vein: centralVein.max(stem),
  }
}

/** Four occluding botanical strata under a continuous polished resin skin; no scene-color dependency. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const honey = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    let interior: Node<'vec3'> = mix(color(hsl.integer(45, 78, 21)), color(hsl.integer(52, 88, 56)), honey.mul(0.65).add(facing.mul(0.25)))
    let relief: Node<'float'> = float(0)
    // Back-to-front compositing gives leaves real occlusion rather than additive ghosting.
    for (let layer = 3;layer >= 0;layer--) {
      const depth = 0.018 + layer * 0.028
      const period = vec2(16, 2)
      const q = tube.sub(ray.mul(depth)).mul(period).add(vec2(layer * 0.317, layer * 0.271))
      const rnd = cellNoiseVec3(vec3(wrapCell(q.floor(), period), 5 + layer * 7))
      const point = q.fract().sub(0.5)
      const sway = time.mul(0.31).add(rnd.y.mul(6.28)).sin().mul(0.045).add(rnd.x.sub(0.5).mul(0.25))
      const frond = fern(point, q.fwidth().length().max(0.0001), sway)
      const gate = rnd.z.smoothstep(0.23, 0.35)
      const mask = frond.mask.mul(gate).mul(0.83 - layer * 0.08)
      const leafColor = mix(color(hsl.integer(43, 63, 15)), color(hsl.integer(50, 86, 42)), float(layer / 4)).add(color(hsl.integer(78, 82, 77)).mul(frond.vein).mul(0.3))
      interior = mix(interior, leafColor, mask)
      relief = relief.max(mask.mul(1 - layer * 0.2))
    }
    const inclusions = beads(p.sub(view.mul(0.055)).mul(72), 9)
    const bubbleRing = inclusions.cap.sub(0.45).abs().smoothstep(0.12, 0.25).oneMinus().mul(inclusions.mask)
    interior = mix(interior, color(hsl.integer(50, 68, 21)), inclusions.mask.mul(0.3).mul(intimate))
    interior = interior.add(color(hsl.integer(84, 100, 87.4)).mul(bubbleRing).mul(intimate).mul(0.6))
    const flow = mx_noise_float(p.mul(18).add(vec3(0, time.mul(0.015), 0)))
    this.colorNode = interior.mul(mix(float(0.58), float(1), facing))
    this.metalness = 0.04
    this.roughness = 0.16
    this.ior = 1.54
    this.clearcoat = 1
    this.clearcoatRoughness = 0.055
    this.clearcoatNormalNode = normalViewGeometry
    this.normalNode = proceduralNormal(flow, 0.00032)
    this.specularColorNode = color(hsl.integer(82, 100, 95.3))
    this.emissiveNode = interior.mul(facing.mul(0.23).add(0.035)).add(color(hsl.integer(60, 92, 68)).mul(grazing.pow(4)).mul(0.065))
    this.aoNode = relief.mul(-0.12).add(1)
  }
}
