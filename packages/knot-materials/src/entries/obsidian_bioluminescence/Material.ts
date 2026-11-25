import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, positionGeometry, positionView, time, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const arteries = filament(mx_noise_float(inner.mul(14).add(time.mul(0.1))), 0.015)
    const deepVeins = filament(mx_noise_float(deep.mul(25)), 0.02)
    const pulse = time.mul(1.2).sin().mul(0.3).add(0.7)
    this.colorNode = color(hsl.integer(285, 18, 4))
    this.roughness = 0.05
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.transmission = 0.1
    this.thickness = 0.5
    this.ior = 1.8
    this.emissiveNode = mix(color(hsl.integer(209, 100, 82)), color(hsl.integer(350, 100, 60.4)), mx_noise_float(p.mul(4))).mul(arteries).mul(pulse).mul(near.mul(1.5).add(0.5)).add(color(hsl.integer(254, 100, 57.3)).mul(deepVeins).mul(near).mul(0.6))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(20)), 0.002)
  }
}
