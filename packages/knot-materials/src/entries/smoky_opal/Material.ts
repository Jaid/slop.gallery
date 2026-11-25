import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
// Slow internal atomic luminescence drift
    const slowDrift = vec3(time.mul(0.012), time.mul(-0.008), time.mul(0.015))
// Primary harlequin mosaic domains (Bragg diffraction lattice)
    const domainCoord = p.mul(22).add(slowDrift)
    const domainId = mx_worley_noise_float(domainCoord, 1, 1)
    const domainRnd = cellNoiseVec3(vec3(domainId.mul(65_536), 7, 19))
    const domainFootprint = domainCoord.fwidth().length()
    const domainMask = cellularBoundary(domainCoord).smoothstep(0, domainFootprint.add(0.14)).mul(domainFootprint.smoothstep(0.45, 1.5).oneMinus())
    const latticeNormal = domainRnd.sub(0.5).normalize()
// Angle of incidence against the domain's micro-crystal lattice planes
    const braggAlignment = view.dot(latticeNormal).abs()
    const braggWavelength = braggAlignment.mul(3.4).add(domainRnd.z.mul(2.2))
    const domainColor = cosinePalette(braggWavelength, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1, 1, 1], [0, 0.33, 0.67])
// Sharp Bragg diffraction flash window
    const flashSharpness = domainRnd.x.mul(14).add(10)
    const domainFlash = braggAlignment.pow(flashSharpness).mul(domainRnd.y.smoothstep(0.2, 0.35)).mul(domainMask)
// Secondary deep subsurface play-of-color layer via parallax offset
    const pDeep = p.sub(view.mul(0.045)).add(slowDrift.mul(1.5))
    const deepCoord = pDeep.mul(32)
    const deepId = mx_worley_noise_float(deepCoord, 1, 1)
    const deepRnd = cellNoiseVec3(vec3(deepId.mul(65_536), 31, 53))
    const deepFootprint = deepCoord.fwidth().length()
    const deepMask = cellularBoundary(deepCoord).smoothstep(0, deepFootprint.add(0.14)).mul(deepFootprint.smoothstep(0.45, 1.5).oneMinus())
    const deepNormal = deepRnd.sub(0.5).normalize()
    const deepAlignment = view.dot(deepNormal).abs()
    const deepWavelength = deepAlignment.mul(3.8).add(deepRnd.z.mul(2.5)).add(0.4)
    const deepColor = cosinePalette(deepWavelength, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1, 1, 1], [0.1, 0.45, 0.8])
    const deepFlash = deepAlignment.pow(16).mul(deepRnd.y.smoothstep(0.25, 0.4)).mul(near.mul(0.8).add(0.4)).mul(deepMask)
// Micro pinfire sparkle points
    const sparkCoord = p.mul(140)
    const sparkRnd = cellNoiseVec3(sparkCoord.floor())
    const sparkCenter = sparkRnd.mul(0.5).add(0.25)
    const sparkFootprint = sparkCoord.fwidth().length()
    const sparkRadius = sparkFootprint.add(0.18).min(0.24)
    const sparkMask = sparkCoord.fract().sub(sparkCenter).length().smoothstep(0.06, sparkRadius).oneMinus().mul(sparkFootprint.smoothstep(0.32, 1.15).oneMinus())
    const sparkNormal = sparkRnd.sub(0.5).normalize()
    const sparkFlash = view.dot(sparkNormal).clamp().pow(36).mul(sparkRnd.x.smoothstep(0.84, 0.92)).mul(near).mul(sparkMask)
// Dark smoky potch silica matrix
    const potchSwirl = mx_noise_float(p.mul(4.2)).mul(0.5).add(0.5)
    const smokyPotch = mix(color(hsl.integer(326, 13, 4)), color(hsl.integer(48, 22, 9)), potchSwirl)
// Physical properties of Australian black fire opal
    this.transmission = 0.38
    this.thickness = 0.45
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(61, 53, 11))
    this.attenuationDistance = 1.4
    this.colorNode = smokyPotch
    this.metalness = 0.04
    this.roughnessNode = float(0.06).add(potchSwirl.mul(0.04))
// Vitreous gemological clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.iridescence = 0.3
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = grazing.mul(320).add(140)
// Subtle conchoidal fracturing relief
    const relief = potchSwirl.mul(0.0012).add(domainFlash.mul(0.001))
    this.normalNode = proceduralNormal(relief, 0.8)
// Blazing play-of-color emission
    this.emissiveNode = domainColor.mul(domainFlash).mul(3.8)
      .add(deepColor.mul(deepFlash).mul(2.8))
      .add(color(hsl.integer(0, 0, 100)).mul(sparkFlash).mul(4.5))
      .add(color(hsl.integer(70, 100, 77)).mul(domainFlash.pow(2)).mul(1.5))
      .add(color(hsl.integer(300, 68, 8)).mul(rim).mul(0.25))
      .add(deepColor.mul(deepMask).mul(intimate).mul(0.12))
  }
}
