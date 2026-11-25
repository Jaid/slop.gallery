import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    // Worley cell borders become the lead came between coloured panes.
    const cells = mx_worley_noise_float(p.mul(3.4))
    const lead = opticalLine(cells.sub(0.24), 0.04)
    const pane = mx_noise_float(p.mul(1.9)).mul(0.5).add(0.5)
    const tint = spectralColor(pane.mul(2.1).add(0.3))
    const glassSurface = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    // Light creeping across the window over the course of a slow minute.
    const sunSweep = p.y.mul(1.4).add(time.mul(0.06)).sin().mul(0.5).add(0.5)
    this.colorNode = mix(mix(color(hsl.integer(253, 44, 92)), tint, 0.85), color(hsl.integer(276, 17, 6)), lead)
    this.transmission = 0.92
    this.thickness = 0.65
    this.ior = 1.52
    this.dispersion = 0.35
    this.attenuationColor.set(hsl.integer(257, 64, 64))
    this.attenuationDistance = 0.8
    this.roughnessNode = glassSurface.mul(0.05).add(lead.mul(0.45)).add(0.02)
    this.metalnessNode = lead.mul(0.6)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(glassSurface.mul(0.4).add(lead), 0.0016)
    this.emissiveNode = tint.mul(lead.oneMinus()).mul(sunSweep).mul(near.mul(0.5).add(0.3)).mul(0.55).add(color(hsl.integer(0, 0, 100)).mul(grazing.pow(3)).mul(0.3))
  }
}
