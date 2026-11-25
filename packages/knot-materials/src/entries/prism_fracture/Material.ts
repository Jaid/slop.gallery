import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_vec3, positionGeometry, positionView, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const cells = mx_noise_vec3(p.mul(15))
    const fracture = cells.x.sub(cells.y).abs().smoothstep(0, 0.1).oneMinus()
    const mending = time.mul(0.5).sin().mul(0.5).add(0.5)
    const edgeGlow = fracture.pow(4).mul(mending)
    this.colorNode = color(hsl.integer(0, 0, 8))
    this.metalness = 0.1
    this.roughness = 0.05
    this.transmission = 0.9
    this.thickness = 0.3
    this.ior = 2.4
    this.dispersion = 1
    this.iridescence = 1
    this.iridescenceIOR = 1.8
    this.iridescenceThicknessNode = fracture.mul(400).add(200)
    this.normalNode = proceduralNormal(fracture, 0.02)
    this.emissiveNode = mix(color(hsl.integer(0, 0, 100)), spectralColor(p.x.add(time)), edgeGlow).mul(near.mul(1.5).add(0.5))
  }
}
