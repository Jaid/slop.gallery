import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const rock = mx_fractal_noise_float(p.mul(4), 4, 2, 0.5).mul(0.5).add(0.5)
    const strataField = deep.y.mul(5).add(mx_noise_float(deep.mul(2)).mul(0.3))
    const bands = strataField.fract().smoothstep(0.02, 0.12)
    const flecks = mx_noise_float(inner.mul(20)).smoothstep(0.6, 0.8)
    this.colorNode = mix(color(hsl.integer(65, 33, 32)), color(hsl.integer(80, 29, 76)), bands.mul(0.8).add(rock.mul(0.2)))
    this.roughness = 0.85
    this.metalness = 0
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.6
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(20)), 0.0025)
    this.emissiveNode = color(hsl.integer(94, 100, 95.3)).mul(flecks).mul(0.08).add(color(hsl.integer(82, 100, 90.6)).mul(rim).mul(0.05))
  }
}
