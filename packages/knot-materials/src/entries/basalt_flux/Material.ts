import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalLocal, positionGeometry, positionLocal, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const p = positionGeometry
    const crust = mx_fractal_noise_float(p.mul(3.1), 5, 2, 0.5)
    const lift = crust.mul(0.5).add(0.5)
    // Conservative crust relief: at most 0.012m along the geometric normal.
    this.positionNode = positionLocal.add(normalLocal.mul(lift.mul(0.012)))
    const cells = mx_worley_noise_float(p.mul(4.2))
    const seams = cells.smoothstep(0.02, 0.3).oneMinus()
    const flicker = mx_noise_float(p.mul(2).add(vec3(0, time.mul(0.05), 0))).mul(0.35).add(0.75)
    const heat = seams.mul(flicker).clamp()
    this.colorNode = mix(color(hsl.integer(286, 7, 6)), color(hsl.integer(67, 9, 17)), lift).mul(seams.mul(-0.5).add(1))
    this.metalness = 0.05
    this.roughnessNode = lift.mul(0.1).add(0.78).sub(heat.mul(0.2)).clamp(0.2, 0.95)
    this.normalNode = proceduralNormal(crust.mul(0.9), 0.003)
    this.emissiveNode = mix(color(hsl.integer(33.3, 100, 59.6)), color(hsl.integer(83, 100, 88)), heat.pow(2)).mul(heat).mul(2.4)
  }
}
