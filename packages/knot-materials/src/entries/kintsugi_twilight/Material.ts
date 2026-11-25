import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black urushi ceramic, split by a living net of liquid gold. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, near, intimate} = viewerFrame()
    const warp = mx_fractal_noise_float(p.mul(1.7).add(vec3(0, time.mul(0.006), 0)), 3, 2.05, 0.52)
    const crackField = cellularBoundary(p.mul(2.35).add(warp.mul(0.34)))
    const crackFoot = crackField.fwidth().max(0.001)
    const seam = crackField.abs().smoothstep(0.018, crackFoot.mul(1.6).add(0.038)).oneMinus()
    const resolved = crackField.fwidth().smoothstep(0.18, 0.8).oneMinus()
    const goldMask = seam.mul(resolved)
    const hairField = cellularBoundary(p.mul(8.5).add(warp.mul(0.8)))
    const hair = hairField.abs().smoothstep(0.012, 0.032).oneMinus().mul(hairField.fwidth().smoothstep(0.12, 0.55).oneMinus()).mul(near)
    const glaze = mx_fractal_noise_float(p.mul(4.2), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const ink = mix(color(hsl.integer(264, 25, 4.5)), color(hsl.integer(285, 37, 17)), glaze.pow(1.8).mul(0.75))
    const gold = mix(color(hsl.integer(44, 91, 33)), color(hsl.integer(85, 100, 90.4)), facing.mul(0.45).add(goldMask.mul(0.55)))
    const heat = time.mul(0.34).add(p.x.mul(1.1)).sub(p.z.mul(0.7))
    const pulse = heat.sin().mul(0.5).add(0.5).pow(14).mul(goldMask).mul(intimate)
    const height = goldMask.mul(0.34).add(hair.mul(-0.035)).add(glaze.mul(0.018))
    const ceramicNormal = proceduralNormal(height, 0.003)
    this.colorNode = mix(ink, gold, goldMask).add(color(hsl.integer(94, 100, 94.8)).mul(pulse.mul(0.3)))
    this.metalnessNode = goldMask.mul(0.96)
    this.roughnessNode = float(0.12).add(goldMask.mul(0.15)).add(hair.mul(0.06)).clamp(0.07, 0.32)
    this.clearcoat = 0.84
    this.clearcoatRoughness = 0.065
    this.normalNode = ceramicNormal
    this.clearcoatNormalNode = ceramicNormal
    this.emissiveNode = color(hsl.integer(72, 100, 78)).mul(pulse.mul(0.26)).add(color(hsl.integer(96, 100, 96.7)).mul(glints(ceramicNormal, 100).mul(goldMask).mul(near).mul(0.22)))
  }
}
