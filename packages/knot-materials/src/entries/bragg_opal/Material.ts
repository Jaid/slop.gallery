import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, vec3} from 'three/tsl'

import {braggDiffraction} from '../../candidates/gemini_flash/lib/braggDiffraction.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.transmission = 0.88
    this.thickness = 0.82
    this.ior = 1.45
    this.dispersion = 0.35
    this.attenuationColor.set(hsl.integer(231, 52, 12))
    this.attenuationDistance = 1.2
    this.name = knotData.id
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    // 3D mosaic harlequin domain partitioning
    const domainCoord = p.mul(18)
    // Match crystal identity to the same Voronoi sites that define its borders.
    const domainId = mx_worley_noise_float(domainCoord, 1, 1)
    const domainRnd = cellNoiseVec3(vec3(domainId.mul(65_536), 7, 19))
    const boundary = cellularBoundary(domainCoord)
    const footprint = domainCoord.fwidth().length()
    const tileEdge = boundary.smoothstep(0.02, footprint.add(0.08)).oneMinus()
    // Randomized internal crystal lattice normal for each domain
    const latticeNormal = domainRnd.sub(0.5).mul(2).normalize()
    // Three studio light directions to test the Bragg diffraction condition
    const lamps = [
      vec3(0.35, 0.78, 0.52).normalize(),
      vec3(-0.62, 0.28, 0.73).normalize(),
      vec3(0.1, -0.35, 0.93).normalize(),
    ]
    // Domain sphere spacing determines the dominant diffraction wavelength
    const dSpacing = domainRnd.x.mul(0.4).add(0.7)
    // Sum Bragg diffraction flashes across studio lighting vectors
    let braggFlash: Node<'vec3'> = vec3(0)
    for (const lamp of lamps) {
      const halfVector = lamp.add(view).normalize()
      const flash = braggDiffraction(latticeNormal, halfVector, dSpacing, 45)
      braggFlash = braggFlash.add(flash)
    }
    // Pinfire micro-sparkles inside the domains, awakened on close approach
    const pinCoord = p.mul(65)
    const pinfire = cellularPoints(pinCoord, 0.03, 0.18, 0.6).mul(near)
    // A contained pinfire point keeps its own tint across crystal boundaries.
    const pinIdentity = cellNoiseVec3(pinCoord.floor())
    // Dark ironstone matrix host beneath milky translucent silica cap
    const matrixColor = mix(color(hsl.integer(254, 19, 4)), color(hsl.integer(241, 22, 12)), mx_noise_float(p.mul(8)).mul(0.5).add(0.5))
    const opalescentHaze = color(hsl.integer(229, 63, 76))
    this.colorNode = mix(matrixColor, opalescentHaze, grazing.pow(2).mul(0.35))
    this.roughness = 0.025
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    // Subtle cabochon polished normal with hairline boundary depression
    const cabochonNormal = proceduralNormal(tileEdge.mul(-0.0008), 0.5)
    this.normalNode = cabochonNormal
    // Emissive play-of-color:
    // 1. Bragg diffraction flashes: intense pure spectral fires
    const spectralFires = braggFlash
      .mul(tileEdge.oneMinus())
      .mul(near.mul(0.5).add(0.7))
      .mul(2.5)
    // 2. Micro-pinfire sparkles: vibrant points of colored light
    const pinfireColor = mix(color(hsl.integer(14, 100, 58.8)), color(hsl.integer(160, 100, 82)), pinIdentity.y)
    const pinfireGlow = pinfireColor.mul(pinfire).mul(intimate).mul(3)
    // 3. Rayleigh scattering rim opalescence
    const rayleighRim = color(hsl.integer(233, 72, 76.7)).mul(rim.pow(2.2)).mul(0.3)
    this.emissiveNode = spectralFires
      .add(pinfireGlow)
      .add(rayleighRim)
  }
}
