import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Song-dynasty celadon; golden threads always present, iron-wire crackle revealed up close */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1
    const {p, grazing, rim, near, intimate} = viewerFrame()
    const mottle = mx_fractal_noise_float(p.mul(3.2), 3, 2, 0.5).mul(0.5).add(0.5)
    const coarse = mx_fractal_noise_float(p.mul(14), 2, 2, 0.5)
    const fine = mx_fractal_noise_float(p.mul(34).add(vec3(3.1, 8.7, 5.3)), 2, 2, 0.5)
    const goldThread = filament(coarse, 0.02)
    const ironWire = filament(fine, 0.012).mul(intimate.mul(0.85).add(0.15))
    const glaze = mix(mix(color(hsl.integer(156, 30, 74)), color(hsl.integer(152, 35, 89)), mottle), color(hsl.integer(160, 35, 64)), grazing.pow(2).mul(0.4))
    this.colorNode = mix(mix(glaze, color(hsl.integer(77, 41, 38)), goldThread.mul(0.5)), color(hsl.integer(66, 30, 16)), ironWire.mul(0.65))
    this.roughnessNode = goldThread.max(ironWire).mul(0.3).add(mottle.mul(0.08)).add(0.16)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    this.transmission = 0.12
    this.thickness = 0.3
    this.attenuationColor.set(hsl.integer(160, 48, 81))
    this.attenuationDistance = 0.8
    this.sheen = 0.4
    this.sheenColor.set(hsl.integer(159, 100, 97.8))
    this.sheenRoughness = 0.5
    this.normalNode = proceduralNormal(coarse.mul(0.5).add(mx_noise_float(p.mul(6)).mul(0.3)), 0.0008)
    this.emissiveNode = color(hsl.integer(159, 50, 41)).mul(rim).mul(0.1)
      .add(color(hsl.integer(84, 68, 69)).mul(goldThread).mul(glints(normalViewGeometry, 60)).mul(0.35).mul(near.mul(0.5).add(0.5)))
  }
}
