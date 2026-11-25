import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 1
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.abs().pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const riftNoise = mx_noise_float(p.mul(6.5)).mul(0.4)
    const riftNoiseFine = mx_noise_float(p.mul(18)).mul(0.15)
    const riftField = p.x.mul(9).sin().mul(p.y.mul(9).cos()).add(p.z.mul(9).sin()).add(riftNoise).add(riftNoiseFine)
    const rift = opticalLine(riftField, 0.075)
    const riftCore = opticalLine(riftField, 0.028)
    const deep = p.sub(view.mul(0.24))
    const mantleNoise = mx_noise_float(deep.mul(14).sub(time.mul(0.25))).mul(0.5).add(0.5)
    const convectiveCells = opticalBands(deep.y.mul(22).add(mantleNoise.mul(4)))
    const lava = mix(mix(color(hsl.integer(31.5, 100, 24)), color(hsl.integer(39, 100, 62.4)), rift), color(hsl.integer(100, 100, 95.8)), riftCore.mul(convectiveCells.mul(0.5).add(0.5)))
    this.colorNode = mix(color(hsl.integer(19, 23, 4)), color(hsl.integer(21, 49, 7)), rift.mul(0.4))
    this.metalness = 0.1
    this.roughness = 0.035
    this.clearcoat = 1
    this.clearcoatRoughness = 0.016
    this.normalNode = proceduralNormal(riftNoise.mul(intimate), 0.0016)
    this.emissiveNode = lava.mul(rift).mul(near.mul(0.65).add(0.45)).add(color(hsl.integer(99, 100, 94.1)).mul(riftCore).mul(near.mul(0.7).add(0.5)).mul(1.5)).add(color(hsl.integer(33, 100, 59)).mul(rim.pow(3)).mul(0.35))
  }
}
