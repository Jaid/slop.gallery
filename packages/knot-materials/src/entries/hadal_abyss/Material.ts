import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.75
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.abs().pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const combCoord = p.x.mul(14).add(p.y.mul(22)).sub(p.z.mul(11))
    const combWave = combCoord.add(time.mul(0.5))
    const cilia = opticalLine(combWave.sin(), 0.042)
    const ciliaRainbow = spectralColor(combWave.mul(1.6).add(grazing.mul(6)).add(view.x.mul(3)))
    const deep = p.sub(view.mul(0.24))
    const nerveWave = deep.y.mul(15).sub(time.mul(2)).sin().mul(0.5).add(0.5).pow(22)
    const photophoreField = mx_noise_float(deep.mul(16))
    const photophores = opticalLine(photophoreField.sub(0.25), 0.035).mul(nerveWave)
    const fineCilia = opticalLine(p.dot(vec3(42, -18, 28)).sin(), 0.02).mul(intimate)
    this.colorNode = mix(color(hsl.integer(242, 100, 6)), color(hsl.integer(248, 100, 13)), grazing.mul(0.6))
    this.transmission = 0.95
    this.thickness = 0.7
    this.ior = 1.334
    this.dispersion = 0.32
    this.attenuationColor.set(hsl.integer(244, 100, 8))
    this.attenuationDistance = 0.45
    this.roughness = 0.02
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.emissiveNode = ciliaRainbow.mul(cilia).mul(near.mul(0.75).add(0.35)).add(color(hsl.integer(178, 100, 85)).mul(photophores).mul(near.mul(0.9).add(0.4)).mul(1.5)).add(color(hsl.integer(233, 93, 71)).mul(fineCilia).mul(0.6)).add(color(hsl.integer(171, 100, 87)).mul(rim.abs().pow(2)).mul(0.3))
  }
}
