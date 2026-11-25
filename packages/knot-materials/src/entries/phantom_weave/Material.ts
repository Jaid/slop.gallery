import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, uv, vec2, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A satin smart-weave whose silver warp catches a restrained aurora at grazing angles. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const weave = vec2(tube.x.mul(TAU * 42), tube.y.mul(TAU * 18))
    const warp = weave.x.add(mx_fractal_noise_float(p.mul(2.1), 2, 2, 0.5).mul(1.1)).sin().mul(0.5).add(0.5)
    const weft = weave.y.add(mx_fractal_noise_float(p.mul(2.6).add(4.1), 2, 2, 0.5).mul(1)).sin().mul(0.5).add(0.5)
    const crossing = warp.mul(weft).mul(2).clamp(0, 1)
    const filament = warp.mul(0.54).add(weft.mul(0.46))
    const filamentFoot = weave.length().fwidth().max(0.001)
    const resolved = filamentFoot.smoothstep(0.06, 0.28).oneMinus()
    const threads = mix(float(0.1), float(0.42), crossing).add(filament.mul(resolved).mul(0.12))
    const warpGlint = warp.pow(14).mul(resolved)
    const weftGlint = weft.pow(14).mul(resolved)
    const direction = view.dot(vec3(0.58, 0.37, -0.73)).mul(0.5).add(0.5)
    const indigo = mix(color(hsl.integer(275, 55, 6)), color(hsl.integer(268, 77, 28)), direction)
    const silver = mix(color(hsl.integer(265, 25, 48)), color(hsl.integer(243, 100, 95.4)), facing.mul(0.48).add(warpGlint.mul(0.32)))
    const weaveColor = mix(indigo, silver, threads.mul(0.7))
    const height = crossing.mul(0.1).add(warp.mul(weft).mul(0.03)).add(filament.mul(resolved).mul(0.02))
    const satinNormal = proceduralNormal(height, 0.0028)
    const broadGlint = glints(satinNormal, 20).mul(near).mul(0.1)
    const fiberGlint = glints(satinNormal, 84).mul(warpGlint.add(weftGlint)).mul(near).mul(0.26)
    this.colorNode = weaveColor.add(color(hsl.integer(224, 100, 94)).mul(fiberGlint)).add(color(hsl.integer(286, 73, 52)).mul(broadGlint.mul(grazing)))
    this.metalnessNode = float(0.34).add(warpGlint.mul(0.32)).add(weftGlint.mul(0.24))
    this.roughnessNode = float(0.32).sub(filament.mul(0.1)).add(grazing.mul(0.035)).clamp(0.14, 0.52)
    this.anisotropy = 0.72
    this.anisotropyRotation = 0
    this.clearcoat = 0.36
    this.clearcoatRoughness = 0.14
    this.sheen = 0.58
    this.sheenColor.set(hsl.integer(274, 69, 54))
    this.sheenRoughness = 0.36
    this.normalNode = satinNormal
    this.emissiveNode = color(hsl.integer(249, 100, 86)).mul(fiberGlint.mul(0.1)).add(color(hsl.integer(287, 100, 59.6)).mul(broadGlint.mul(intimate).mul(0.065)))
  }
}
