import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, modelWorldMatrixInverse, mx_fractal_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const plasmaNoise = mx_fractal_noise_float(inner.mul(2.2).add(vec3(time.mul(0.06), time.mul(0.04), 0)), 3, 2, 0.5)
    const plasma = filament(plasmaNoise, 0.035)
    const chroma = spectralColor(plasmaNoise.mul(5).add(time.mul(0.2)))
    this.colorNode = color(hsl.integer(224, 100, 95))
    this.transmission = 0.82
    this.thickness = 0.5
    this.ior = 1.15
    this.attenuationColor.set(hsl.integer(230, 100, 90))
    this.attenuationDistance = 0.8
    this.roughness = 0.04
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = liquidNormal(near, 0.05)
    this.emissiveNode = chroma.mul(plasma).mul(2.4).mul(near.mul(0.8).add(0.4)).add(color(hsl.integer(0, 0, 100)).mul(plasma.pow(3)).mul(0.4)).add(color(hsl.integer(222, 100, 86)).mul(rim).mul(0.3))
  }
}
