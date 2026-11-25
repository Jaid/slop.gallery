import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {hairline as opticalLine} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Volcanic glass over a live magma web; the rifts breathe harder when you lean in. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const deep = p.sub(view.mul(0.07))
    const drift = vec3(time.mul(0.055), time.mul(-0.04), time.mul(0.03))
    const coarse = mx_noise_float(deep.mul(2.4).add(drift))
    const fine = mx_noise_float(deep.mul(6.8).sub(drift.mul(1.6)).add(coarse.mul(0.9)))
    const crackField = fine.add(coarse.mul(0.5))
    const crack = opticalLine(crackField, 0.045)
    const core = opticalLine(crackField, 0.012)
    const halo = crackField.abs().smoothstep(0.03, 0.34).oneMinus()
    const micro = opticalLine(mx_noise_float(deep.mul(15)).add(crackField.mul(0.25)), 0.02).mul(intimate)
    const vein = time.mul(0.9).add(p.y.mul(6)).sin().mul(0.3).add(0.85)
    const breath = time.mul(0.4).sin().mul(0.15).add(0.85)
    const heat = near.mul(0.5).add(intimate.mul(0.6)).add(0.35).mul(breath)
    const chambers = mx_fractal_noise_float(p.mul(1.6), 2, 2, 0.5).smoothstep(0.3, 0.75)
    const ember = mix(color(hsl.integer(43.7, 100, 65.3)), color(hsl.integer(83, 100, 91.4)), core.add(crack.mul(0.35)).clamp())
    this.colorNode = mix(color(hsl.integer(60, 15, 5)), color(hsl.integer(32, 69, 13)), grazing.pow(2).mul(0.75))
    this.metalness = 0.15
    this.roughnessNode = crack.mul(0.3).add(chambers.mul(0.05)).add(0.05)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.normalNode = proceduralNormal(crackField.abs().smoothstep(0, 0.22), 0.003)
    this.emissiveNode = ember.mul(crack.mul(1.7).mul(vein).add(halo.mul(0.38)).add(micro.mul(0.9))).mul(heat).mul(facing.mul(0.35).add(0.75)).add(color(hsl.integer(33, 96, 29)).mul(chambers).mul(grazing.pow(1.5)).mul(0.55)).add(color(hsl.integer(36.5, 100, 62.7)).mul(grazing.pow(4)).mul(0.2))
  }
}
