import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Glaze pooling (fractal) plus a crazing network (worley cell walls) sunk into the surface.
    const glaze = mx_fractal_noise_float(p.mul(2.4), 4, 2, 0.5).mul(0.5).add(0.5)
    const cracks = opticalLine(mx_worley_noise_float(p.mul(7.5)).sub(0.34), 0.012)
    const copper = glaze.smoothstep(0.55, 0.78)
    const base = mix(color(hsl.integer(226, 20, 9)), color(hsl.integer(194, 91, 40)), glaze.smoothstep(0.2, 0.6))
    const lustred = mix(base, color(hsl.integer(45, 82, 48)), copper)
    this.colorNode = mix(lustred, color(hsl.integer(359, 23, 9)), cracks)
    this.metalnessNode = copper.mul(0.55)
    this.roughnessNode = cracks.mul(0.5).add(0.08).add(glaze.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.normalNode = proceduralNormal(cracks.mul(-0.6).add(glaze.mul(0.2)), 0.0018)
    this.iridescence = 0.35
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = glaze.mul(300).add(220)
    this.emissiveNode = color(hsl.integer(78, 100, 89)).mul(copper).mul(grazing.pow(3)).mul(0.2)
  }
}
