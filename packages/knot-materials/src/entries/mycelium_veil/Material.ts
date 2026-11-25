import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const fiber = mx_fractal_noise_float(p.mul(2.4), 4, 2, 0.5).mul(0.5).add(0.5)
    const spores = mx_noise_float(inner.mul(8)).smoothstep(0.55, 0.75)
    const pulse = time.mul(0.6).add(mx_noise_float(p.mul(2)).mul(6.283)).sin().mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(62, 34, 20)), color(hsl.integer(80, 37, 67)), fiber)
    this.transmission = 0.3
    this.thickness = 0.3
    this.ior = 1.35
    this.attenuationColor.set(hsl.integer(83, 46, 87))
    this.attenuationDistance = 0.4
    this.roughness = 0.72
    this.metalness = 0
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.5
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(20)), 0.002)
    this.emissiveNode = color(hsl.integer(131, 100, 92.6)).mul(spores).mul(pulse).mul(0.6).mul(near.mul(0.7).add(0.3)).add(color(hsl.integer(94, 100, 97)).mul(rim).mul(0.08))
  }
}
