import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const band = p.y.mul(8).add(time.mul(0.05)).sin().mul(0.5).add(0.5)
    this.colorNode = color(hsl.integer(254, 29, 95))
    this.transmission = 0.9
    this.thickness = 0.35
    this.ior = 1.45
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(258, 100, 92))
    this.attenuationDistance = 1.1
    this.roughness = 0.02
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 1
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = band.mul(500).add(120)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(30)), 0.0002)
    this.emissiveNode = spectralColor(band.mul(5).add(time.mul(0.1))).mul(0.3).mul(grazing.mul(0.8).add(0.2)).add(color(hsl.integer(0, 0, 100)).mul(rim.pow(3)).mul(0.25))
  }
}
