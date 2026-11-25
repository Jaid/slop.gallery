import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, time, vec3} from 'three/tsl'

import {resolved, softNoise} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Opaque, ray-layered carved bone. The holes are shaded cavities, not alpha holes in the mesh. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = data.id
    const {p, view, near, grazing} = viewerFrame()
    const breathing = time.mul(0.22).sin().mul(0.035)
    const warp = vec3(mx_noise_float(p.mul(4)), mx_noise_float(p.mul(4).add(12.1)), mx_noise_float(p.mul(4).add(23.4))).mul(0.055).toVar()
    const surface = p.add(warp).toVar()
    const web = (point: Node<'vec3'>, scale: number, width: number) => {
      const domain = point.mul(scale)
      const d = mx_worley_noise_vec3(domain, 0.9, 0).toVar()
      const gap = d.y.sub(d.x)
      const aa = domain.fwidth().length().mul(0.65).max(0.0001)
      return gap.smoothstep(width, aa.add(width)).oneMinus()
    }
    const outer = web(surface, 13.5, 0.17).toVar()
    const middlePoint = surface.sub(view.mul(0.038)).add(0.074)
    const innerPoint = surface.sub(view.mul(0.092)).add(0.19)
    const middle = web(middlePoint, 19, 0.11).toVar()
    const inner = web(innerPoint, 27, 0.075).toVar()
    const shadow = color(hsl.integer(47, 37, 7)).mul(1)
    const copper = mix(color(hsl.integer(52, 63, 25)), color(hsl.integer(71, 65, 59)), softNoise(innerPoint.mul(8)).mul(0.5).add(0.5))
    const innerColor = mix(shadow, copper, inner.mul(0.8))
    const middleBone = mix(color(hsl.integer(67, 56, 50)), color(hsl.integer(84, 54, 78)), middle)
    const inside = mix(innerColor, middleBone, middle.mul(0.85))
    const age = softNoise(p.mul(7)).mul(0.5).add(0.5).toVar()
    const poresDomain = p.mul(150)
    const pores = mx_worley_noise_vec3(poresDomain, 1, 0).x.smoothstep(0.04, 0.17).oneMinus().mul(resolved(poresDomain.fwidth().length(), 0.25)).toVar()
    const ivory = mix(color(hsl.integer(75, 43, 70)), color(hsl.integer(90, 100, 96.6)), age.mul(0.55).add(0.35)).mul(pores.mul(-0.21).add(1)).toVar()
    const edge = outer.smoothstep(0.05, 0.5).sub(outer.smoothstep(0.7, 1)).clamp().toVar()
    this.colorNode = mix(inside, ivory, outer).mul(edge.mul(-0.13).add(1))
    this.metalnessNode = outer.oneMinus().mul(inner).mul(0.45)
    this.roughnessNode = float(0.52).add(pores.mul(0.18)).sub(outer.oneMinus().mul(inner).mul(0.16))
    this.normalNode = proceduralNormal(outer.mul(0.006).add(age.mul(0.0008)).sub(pores.mul(0.00023)), 0.75)
    this.clearcoatNode = outer.mul(0.14)
    this.clearcoatRoughness = 0.36
    this.aoNode = mix(float(0.3), float(1), outer).add(middle.mul(outer.oneMinus()).mul(0.18)).clamp()
    this.emissiveNode = color(hsl.integer(66, 78, 69)).mul(inner).mul(middle.oneMinus()).mul(outer.oneMinus()).mul(near.mul(0.08).add(0.025)).mul(breathing.add(0.96))
    this.sheenNode = color(hsl.integer(89, 100, 95.7)).mul(outer).mul(grazing).mul(0.12)
    this.sheenRoughness = 0.65
  }
}
