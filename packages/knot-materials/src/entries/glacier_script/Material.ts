import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, refract, time, vec3} from 'three/tsl'

import {approach} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Refracted layers of trapped air, cleavage flakes and blue faults remain suspended under a continuous skin of glacier ice. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, grazing, facing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const ray = refract(view.negate(), normalLocal.normalize(), float(1 / 1.31))
    let inclusions: Node<'vec3'> = vec3(0)
    let coverage: Node<'float'> = float(0)
    // Back-to-front translucent cleavage flakes. Bounded cell support avoids tiled cuts at cell borders.
    for (let i = 4;i >= 0;i--) {
      const depth = 0.015 + i * 0.032
      const sample = p.add(ray.mul(depth))
      const q = vec3(sample.x.add(sample.y.mul(0.34)), sample.y.sub(sample.z.mul(0.27)), sample.z).mul(vec3(12, 9, 14)).add(i * 7.31)
      const id = cellNoiseVec3(q.floor())
      const local = q.fract().sub(0.5).sub(id.sub(0.5).mul(0.16))
      const aa = q.fwidth().length().max(0.001)
      const plane = local.y.add(local.x.mul(id.x.sub(0.5))).add(local.z.mul(0.3)).abs()
      const perimeter = local.x.abs().mul(0.8).add(local.z.abs()).smoothstep(0.28, 0.4).oneMinus()
      const sheet = plane.smoothstep(0.008, aa.mul(0.6).add(0.033)).oneMinus().mul(perimeter).mul(id.z.smoothstep(0.22, 0.45))
      const edge = plane.smoothstep(0.004, aa.mul(0.5).add(0.012)).oneMinus().mul(perimeter)
      const glimmer = sample.dot(vec3(17, -11, 23)).add(view.x.mul(11)).add(time.mul(0.24)).sin().mul(0.5).add(0.5)
      const tint = mix(color(hsl.integer(233, 76, 49)), color(hsl.integer(194, 73, 92)), id.y.mul(0.65).add(glimmer.mul(0.3)))
      const strength = sheet.mul(0.48).add(edge.mul(0.18)).mul(1 - i * 0.13)
      inclusions = mix(inclusions, tint, strength)
      coverage = coverage.add(strength.mul(coverage.oneMinus()))
    }
    const faultSample = p.add(ray.mul(0.095))
    const faultPhase = faultSample.dot(vec3(-0.4, 0.7, 1)).mul(34).add(mx_noise_float(faultSample.mul(4)).mul(2))
    const faultWidth = faultPhase.fwidth().max(0.001)
    const fault = faultPhase.sin().abs().smoothstep(0.018, faultWidth.mul(0.7).add(0.095)).oneMinus().mul(faultWidth.smoothstep(0.25, 1.6).oneMinus())
    inclusions = inclusions.add(color(hsl.integer(217, 49, 79)).mul(fault).mul(0.24))
    const cloud = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const frostGrain = mx_noise_float(p.mul(145)).mul(0.5).add(0.5)
    const frost = cloud.smoothstep(0.58, 0.81).mul(grazing.mul(0.55).add(0.45))
    const bubbleQ = p.add(ray.mul(0.06)).mul(62)
    const random = cellNoiseVec3(bubbleQ.floor())
    const bubbleR = bubbleQ.fract().sub(random.mul(0.35).add(0.325)).length()
    const bubbleAA = bubbleQ.fwidth().length().max(0.001)
    const bubbles = bubbleR.sub(0.11).abs().smoothstep(0.012, bubbleAA.add(0.02)).oneMinus().mul(random.z.smoothstep(0.86, 0.93)).mul(bubbleAA.smoothstep(0.18, 0.7).oneMinus()).mul(near)
    const body = mix(color(hsl.integer(249, 84, 21)), color(hsl.integer(223, 77, 48)), cloud)
    this.colorNode = mix(body.add(inclusions.mul(0.65)), color(hsl.integer(207, 31, 82)), frost.mul(0.65)).add(bubbles.mul(color(hsl.integer(210, 34, 72))).mul(0.5))
    this.metalness = 0.08
    this.roughnessNode = frost.mul(0.35).add(0.13).add(frostGrain.mul(0.04))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.065
    this.ior = 1.31
    this.normalNode = proceduralNormal(cloud.mul(0.001).add(frostGrain.mul(frost).mul(near).mul(0.00018)), 0.6)
    this.emissiveNode = inclusions.mul(0.45).add(color(hsl.integer(222, 74, 70)).mul(grazing.pow(4)).mul(0.12)).add(bubbles.mul(color(hsl.integer(208, 100, 93.4))).mul(facing).mul(0.12))
    this.aoNode = coverage.mul(0.12).add(0.88)
  }
}
