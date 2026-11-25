import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
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
    const depth = p.sub(view.mul(0.085))
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const polyps = mx_noise_float(inner.mul(9)).smoothstep(0.35, 0.55)
    const surfaceFleck = mx_noise_float(depth.mul(16)).smoothstep(0.5, 0.68)
    const phase = mx_noise_float(p.mul(3)).mul(6.283)
    const pulse = time.mul(1.1).add(phase).sin().mul(0.5).add(0.5)
    const deepPolyps = mx_noise_float(deep.mul(11)).smoothstep(0.4, 0.6)
    this.colorNode = mix(color(hsl.integer(5, 66, 14)), color(hsl.integer(3, 100, 77)), noise)
    this.transmission = 0.7
    this.thickness = 0.42
    this.ior = 1.4
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(7, 76, 49))
    this.attenuationDistance = 0.5
    this.roughness = 0.12
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.08
    this.normalNode = liquidNormal(near, 0.14)
    // Each polyp pulses on its own phase, offset from a low-frequency noise field.
    this.emissiveNode = color(hsl.integer(3, 100, 68.4)).mul(polyps).mul(pulse.mul(0.7).add(0.3)).mul(near.mul(0.6).add(0.5)).add(color(hsl.integer(74, 100, 96.7)).mul(surfaceFleck).mul(near).mul(0.25)).add(color(hsl.integer(84, 100, 91)).mul(deepPolyps).mul(near).mul(0.35)).add(color(hsl.integer(4, 100, 63.7)).mul(rim).mul(0.16))
  }
}
