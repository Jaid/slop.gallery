import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 1. CRYOGENIC KINTSUGI: Fractured Glacial Ice & Superconducting Gold */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    // Multi-depth voronoi fracture networks
    const shallow = p.sub(view.mul(0.06))
    const deep = p.sub(view.mul(0.18))
    const crackDistA = cellularBoundary(shallow.mul(18).add(mx_noise_vec3(shallow.mul(3)).mul(0.65)))
    const crackDistB = cellularBoundary(deep.mul(12).add(mx_noise_vec3(deep.mul(2)).mul(0.65)))
    const veinSurface = opticalLine(crackDistA, 0.025)
    const veinDeep = opticalLine(crackDistB, 0.035).mul(intimate)
    const veinNetwork = veinSurface.max(veinDeep)
    // Superconducting plasma pulses flowing through the faults
    const pulse = p.y.mul(22).add(p.x.mul(14)).add(time.mul(2.2)).sin().mul(0.5).add(0.5)
    const goldCore = mix(color(hsl.integer(74, 100, 77)), color(hsl.integer(95, 100, 96)), pulse)
    const cyanArc = color(hsl.integer(202, 100, 85)).mul(pulse.pow(4)).mul(veinSurface)
    // Crystalline frost roughness and micro-bumpiness
    const frostNoise = mx_fractal_noise_float(p.mul(48), 3, 2, 0.6)
    const frostPatch = mx_noise_float(p.mul(6)).smoothstep(0.1, 0.5)
    this.colorNode = color(hsl.integer(223, 73, 7))
    this.transmission = 0.94
    this.thickness = 0.75
    this.ior = 1.31
    // Glacial Ice IOR
    this.dispersion = 0.55
    // High prismatic spectral split
    this.attenuationColor.set(hsl.integer(210, 85, 77))
    this.attenuationDistance = 0.38
    this.roughnessNode = frostPatch.mul(frostNoise).mul(0.35).add(0.02)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(frostNoise.mul(frostPatch).mul(0.15), 0.001)
    this.emissiveNode = goldCore.mul(veinNetwork).mul(2.8)
      .add(cyanArc.mul(4))
      .add(color(hsl.integer(226, 100, 74)).mul(rim).mul(0.18))
      .mul(near.mul(0.6).add(0.6))
  }
}
