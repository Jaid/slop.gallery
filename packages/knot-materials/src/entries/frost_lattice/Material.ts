import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalGeometry, positionGeometry} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

const DISPLACEMENT = 0.004

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const p = positionGeometry
    const facets = mx_noise_float(p.mul(8)).mul(0.5).add(0.5)
    const bump = mx_noise_float(p.mul(24)).mul(0.5).add(0.5)
    this.positionNode = p.add(normalGeometry.mul(bump.sub(0.5).mul(DISPLACEMENT * 2)))
    this.colorNode = mix(color(hsl.integer(238, 99, 94)), color(hsl.integer(0, 0, 100)), facets)
    this.transmission = 0.85
    this.thickness = 0.4
    this.ior = 1.31
    this.dispersion = 0.05
    this.attenuationColor.set(hsl.integer(236, 100, 89))
    this.attenuationDistance = 0.7
    this.roughness = 0.08
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(facets, 0.0015)
  }
}
