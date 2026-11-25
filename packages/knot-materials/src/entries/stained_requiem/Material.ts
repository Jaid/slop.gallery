import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const hue = mx_noise_float(inner.mul(3.2)).mul(9).add(view.x.mul(2)).add(view.y.mul(1.5))
    const panes = spectralColor(hue).mul(0.6).add(0.25)
    const leadX = filament(p.x.mul(9).add(mx_noise_float(p.mul(2)).mul(3)).sin(), 0.05)
    const leadY = filament(p.y.mul(9).add(mx_noise_float(p.mul(2).add(vec3(5, 1, 3))).mul(3)).sin(), 0.05)
    const lead = leadX.max(leadY)
    this.colorNode = mix(panes, color(hsl.integer(0, 0, 5.5)), lead)
    this.transmissionNode = lead.oneMinus().mul(facing.mul(0.4).add(0.5))
    this.thickness = 0.4
    this.ior = 1.5
    this.dispersion = 0.3
    this.attenuationColor.set(hsl.integer(336, 64, 35))
    this.attenuationDistance = 0.5
    this.roughnessNode = lead.mul(0.35).add(0.05)
    this.metalnessNode = lead.mul(0.6)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(6)), 0.0015)
    this.emissiveNode = spectralColor(hue.add(time.mul(0.15))).mul(lead.oneMinus()).mul(near.mul(0.5).add(0.35)).add(color(hsl.integer(78, 100, 89.8)).mul(lead).mul(0.05))
  }
}
