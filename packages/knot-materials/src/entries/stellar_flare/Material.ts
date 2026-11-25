import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, rim, near, intimate} = viewerFrame()
    // Solar granulation: boiling convective Voronoi cells
    const granuleCoord = p.mul(24)
    const granuleDist = cellularBoundary(granuleCoord)
    const granuleCenter = granuleDist.smoothstep(0.04, 0.48)
    const intergranularLane = granuleDist.smoothstep(0.06, 0.015)
    // Acoustic p-mode waves rippling through the photosphere
    const pMode = p.x.mul(14).add(p.y.mul(11)).sub(time.mul(1.4)).sin().mul(0.12)
    const granuleTurbulence = granuleCenter.add(pMode).clamp()
    // Magnetic active regions: sunspot umbra and penumbra
    const spotCoord = p.mul(3.5).add(vec3(0.4, -0.3, 0.2))
    const spotNoise = mx_noise_float(spotCoord.mul(2.2)).mul(0.2)
    const spotRadius = spotCoord.length().add(spotNoise)
    const umbra = spotRadius.smoothstep(0.22, 0.11)
    const penumbra = spotRadius.smoothstep(0.52, 0.24)
    const sunspot = penumbra.add(umbra.mul(0.7)).clamp()
    // Physical solar limb darkening: grazing viewing angles pass through cooler upper layers
    const limbDarkening = facing.mul(0.65).add(0.35)
    // Color gradient across the stellar surface
    const hotCore = mix(color(hsl.integer(72.1, 100, 77)), color(hsl.integer(89, 100, 97.6)), granuleTurbulence)
    const photosphereBase = mix(color(hsl.integer(32, 100, 35.5)), hotCore, intergranularLane.oneMinus())
    const spotColor = mix(color(hsl.integer(35, 100, 17)), color(hsl.integer(40, 100, 4)), umbra)
    const surfaceColor = mix(photosphereBase, spotColor, sunspot)
    this.colorNode = surfaceColor
    this.metalness = 0
    this.roughness = 0.52
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.18
    // Procedural normal: convective boiling relief and sunspot depression
    const boilingHeight = granuleCenter.mul(0.0028).sub(sunspot.mul(0.0035))
    this.normalNode = proceduralNormal(boilingHeight, 0.85)
    // Magnetic coronal loops arcing over the photosphere
    const loopCoord = p.mul(6.8).add(vec3(time.mul(0.06), time.mul(-0.04), time.mul(0.03)))
    const loopNoise = mx_noise_float(loopCoord)
    const coronalLoop = filament(loopNoise, 0.022)
    const loopHalo = filament(loopNoise, 0.07).mul(0.35)
    // Dynamic solar flares erupting along the magnetic arches
    const flareCycle = time.mul(2.2).add(p.y.mul(7)).sin()
    const activeFlare = flareCycle.smoothstep(0.82, 0.98)
    // Microscopic chromospheric spicules visible on intimate approach
    const spiculeNoise = mx_noise_float(p.mul(68).sub(vec3(0, time.mul(0.9), 0)))
    const spicules = filament(spiculeNoise, 0.016).mul(intimate)
    // Emissive radiant energy:
    // Photosphere blackbody thermal glow
    const thermalEmission = surfaceColor
      .mul(limbDarkening)
      .mul(near.mul(0.4).add(0.75))
      .mul(2.2)
    // Coronal plasma loop arches
    const loopColor = mix(color(hsl.integer(59, 100, 71)), color(hsl.integer(0, 0, 100)), activeFlare)
    const coronalEmission = loopColor
      .mul(coronalLoop.add(loopHalo))
      .mul(activeFlare.mul(1.8).add(0.7))
      .mul(3.6)
    // Fine chromospheric spicules
    const spiculeEmission = color(hsl.integer(39, 100, 62.4)).mul(spicules).mul(2.4)
    // Glowing coronal corona around the limb
    const coronalLimb = color(hsl.integer(65, 100, 73.4)).mul(rim.pow(1.8)).mul(1.5)
    this.emissiveNode = thermalEmission
      .add(coronalEmission)
      .add(spiculeEmission)
      .add(coronalLimb)
  }
}
