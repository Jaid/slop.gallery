import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_noise_vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.2
    const {p, facing, rim, near, intimate} = viewerFrame()
    // Smooth distortion keeps frost continuous across the underlying noise lattice.
    const frostWarp = mx_noise_vec3(p.mul(14)).mul(0.5).add(0.5)
    const frost = mx_noise_float(p.mul(28).add(frostWarp.mul(1.5)))
    // Crystal interiors fade into irregular boundaries instead of revealing cubic noise cells.
    const crystal = cellularBoundary(p.mul(22))
    const facet = crystal.smoothstep(0.04, 0.24)
    const frostLine = opticalLine(frost.mul(20).sin(), 0.04)
    const crack = opticalLine(cellularBoundary(p.mul(9)), 0.03)
    const ice = mix(color(hsl.integer(226, 79, 23)), color(hsl.integer(207, 100, 93)), facet.mul(0.7).add(frostLine.mul(0.4)))
    this.colorNode = ice
    this.transmission = 0.85
    this.thickness = 0.7
    this.ior = 1.31
    this.dispersion = 0.15
    this.attenuationColor.set(hsl.integer(208, 81, 42))
    this.attenuationDistance = 0.8
    this.roughnessNode = facet.mul(0.18).add(0.04)
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.5
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = facing.mul(220).add(180)
    this.normalNode = proceduralNormal(facet.mul(0.7).add(frost.mul(0.2)), 0.002)
    this.emissiveNode = mix(color(hsl.integer(210, 100, 89)), color(hsl.integer(0, 0, 100)), facing).mul(frostLine.add(crack).mul(0.8)).mul(near.mul(0.6).add(0.2)).add(color(hsl.integer(221, 100, 80)).mul(rim).mul(0.25)).add(color(hsl.integer(181, 100, 94.3)).mul(facet.smoothstep(0.7, 0.9)).mul(intimate).mul(0.4))
  }
}
