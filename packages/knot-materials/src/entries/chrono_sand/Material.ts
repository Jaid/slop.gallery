import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const flow = vec3(0, time.mul(-0.1), 0)
    const dunes = mx_noise_float(inner.mul(6).add(flow))
    const suspended = mx_noise_float(deep.mul(40).add(time.mul(0.5))).pow(8)
    const sparkle = suspended.mul(near).mul(3)
    this.colorNode = mix(color(hsl.integer(60, 100, 16)), color(hsl.integer(74, 100, 77)), dunes.mul(0.5).add(0.5))
    this.transmission = 0.85
    this.thickness = 0.6
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(55, 100, 38))
    this.attenuationDistance = 0.4
    this.roughnessNode = dunes.mul(0.1).add(0.05)
    this.clearcoat = 0.5
    this.emissiveNode = color(hsl.integer(90, 100, 84)).mul(sparkle).add(color(hsl.integer(56, 100, 70)).mul(grazing).mul(0.3))
    this.normalNode = proceduralNormal(dunes, 0.005)
  }
}
