import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const flecksField = mx_noise_float(inner.mul(14))
    const flecks = flecksField.smoothstep(0.3, 0.55)
    const fire = spectralColor(flecksField.mul(12).add(view.x.mul(5)).add(view.y.mul(3)).add(time.mul(0.08)))
    const deepFlecks = mx_noise_float(deep.mul(18)).smoothstep(0.35, 0.6)
    this.colorNode = mix(color(hsl.integer(78, 20, 90.5)), color(hsl.integer(77, 100, 98)), noise)
    this.transmission = 0.8
    this.thickness = 0.5
    this.ior = 1.45
    this.dispersion = 0.3
    this.attenuationColor.set(hsl.integer(83, 43, 93))
    this.attenuationDistance = 0.4
    this.roughness = 0.09
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.07
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(10)), 0.0012)
    this.emissiveNode = fire.mul(flecks).mul(near.mul(0.6).add(0.4)).add(spectralColor(flecksField.mul(12).add(2)).mul(deepFlecks).mul(near).mul(0.3)).add(color(hsl.integer(88, 100, 95.5)).mul(rim).mul(0.12))
  }
}
