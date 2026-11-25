import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const frost = mx_fractal_noise_float(p.mul(2), 4, 2, 0.5).mul(0.5).add(0.5)
    const sparkle = mx_noise_float(inner.mul(24)).smoothstep(0.75, 0.9)
    const breath = time.mul(0.4).sin().mul(0.1).add(0.9)
    this.colorNode = mix(color(hsl.integer(0, 0, 100)), color(hsl.integer(238, 36, 91.5)), frost)
    this.transmission = 0.8
    this.thickness = 0.4
    this.ior = 1.31
    this.attenuationColor.set(hsl.integer(240, 100, 96))
    this.attenuationDistance = 0.7
    this.roughness = 0.45
    this.metalness = 0
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.15
    this.iridescence = 0.35
    this.iridescenceIOR = 1.25
    this.iridescenceThicknessNode = frost.mul(120).add(80)
    this.normalNode = proceduralNormal(mx_worley_noise_float(p.mul(7)), 0.002)
    this.emissiveNode = color(hsl.integer(240, 100, 96)).mul(sparkle).mul(near).mul(0.25).mul(breath).add(color(hsl.integer(247, 100, 87.5)).mul(rim).mul(0.35))
  }
}
