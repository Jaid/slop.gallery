import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, normalViewGeometry, reflect, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 5. BIREFRINGENT CRYSTAL Optical Iceland spar calcite monolith with intense extraordinary double refraction. Chromatic dispersion splits incoming environment light, while rhombohedral cleavage planes exhibit internal Newton thin-film rainbow interference fringes in microscopic fractures. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, rim, near} = viewerFrame()
    this.transmission = 0.97
    this.thickness = 0.68
    this.ior = 1.658
    this.dispersion = 0.84
    this.attenuationColor.set(hsl.integer(234, 100, 95))
    this.attenuationDistance = 0.75
    this.roughness = 0.015
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    // Calcite rhombohedral cleavage planes
    const plane1 = p.dot(vec3(0.577, 0.577, 0.577)).mul(24)
    const plane2 = p.dot(vec3(-0.577, 0.577, 0.577)).mul(20)
    const cleavage1 = opticalLine(plane1.fract().sub(0.5), 0.035)
    const cleavage2 = opticalLine(plane2.fract().sub(0.5), 0.035)
    // Newton rings interference fringes within the micro-cleavage gaps
    const fringePhase = plane1.mul(3.2).add(view.x.mul(4.5)).add(view.y.mul(4.5))
    const newtonRainbow = spectralColor(fringePhase)
    // Directional Bragg diffraction flash
    const reflectionDir = reflect(view.negate(), normalViewGeometry)
    const prismAxis = vec3(0.707, 0.707, 0)
    const alignment = reflectionDir.dot(prismAxis).abs().pow(9)
    const spectralFlash = spectralColor(alignment.mul(12).add(time.mul(0.12))).mul(alignment)
    this.colorNode = color(hsl.integer(248, 100, 98.4))
    this.normalNode = proceduralNormal(cleavage1.add(cleavage2).mul(0.04), 0.0006)
    const cleavageGlow = newtonRainbow.mul(cleavage1.add(cleavage2)).mul(1.7)
    this.emissiveNode = cleavageGlow.add(spectralFlash.mul(1.8)).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(220, 100, 86.5)).mul(rim).mul(0.12))
  }
}
