import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const grain = mx_noise_float(vec3(p.x.mul(2), p.y.mul(40), p.z.mul(2)))
    const rings = opticalBands(grain.mul(8))
    const aura = grazing.pow(3)
    this.colorNode = mix(color(hsl.integer(250, 100, 95)), color(hsl.integer(249, 38, 68)), rings.mul(0.3))
    this.transmission = 0.4
    this.thickness = 0.5
    this.ior = 1.3
    this.roughnessNode = rings.mul(0.3).add(0.4)
    this.normalNode = proceduralNormal(grain, 0.01)
    this.emissiveNode = color(hsl.integer(229, 100, 92)).mul(aura).mul(1.5).add(color(hsl.integer(0, 0, 100)).mul(grain.pow(4)).mul(near).mul(0.5))
  }
}
