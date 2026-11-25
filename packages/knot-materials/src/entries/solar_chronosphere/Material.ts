import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, positionGeometry, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    // Pure emissive blackbody radiator
    super(environment, 0)
    this.name = knotData.id
    const {facing, rim, near, intimate} = viewerFrame()
    const p = positionGeometry
    // Disable all external specular reflections
    this.specularIntensityNode = float(0)
    this.metalness = 0
    this.roughness = 1
    this.clearcoat = 0
    // Dynamic solar convective flow advecting in 3D Object Space
    const advectionSpeed = time.mul(0.07)
    const pAdvected = p.add(vec3(advectionSpeed, advectionSpeed.mul(0.55), advectionSpeed.mul(-0.35)))
    // Multi-scale convective hierarchy:
    // 1. Supergranulation: broad regional magnetic active corridors
    const supergranulation = mx_noise_float(p.mul(2.5)).mul(0.5).add(0.5)
    // 2. Multi-octave curl-noise domain warping to break rigid Voronoi cell geometry
    const curl1 = mx_noise_float(pAdvected.mul(6))
    const curl2 = mx_noise_float(pAdvected.mul(12).add(7.1))
    const warpOffset = vec3(curl1, curl2, curl1.add(curl2)).mul(0.09)
    // 3. Convective granulation: Voronoi distance field F2 - F1
    const granuleCoord = pAdvected.mul(21).add(warpOffset)
    const voronoi = mx_worley_noise_vec3(granuleCoord, 1, 0)
    const d1 = voronoi.x
    const laneDist = voronoi.y.sub(d1)
    // Fluid convective profile: convex dome roll-off towards lanes (not a flat polygon)
    // Profile = smoothstep(0, lane_width, laneDist) * (1.0 - 0.25 * d1^2)
    const edgeStep = laneDist.smoothstep(0.015, 0.12)
    const convexDome = float(1).sub(d1.mul(d1).mul(0.35)).clamp(0, 1)
    const cellConvection = edgeStep.mul(convexDome)
    const laneMask = laneDist.smoothstep(0.01, 0.055).oneMinus()
    // 4. Micro-convective surface turbulence and supersonic shear lines
    const microTurbulence = mx_noise_float(granuleCoord.mul(3.2).add(vec3(0, time.mul(0.4), 0)))
      .mul(0.09)
    // Astrophysical quadratic solar limb darkening:
    // I(mu) = 1 - 0.42*(1 - mu) - 0.32*(1 - mu)^2, where mu = facing = N . V
    const oneMinusMu = float(1).sub(facing).clamp(0, 1)
    const limbDarkening = float(1)
      .sub(oneMinusMu.mul(0.42))
      .sub(oneMinusMu.mul(oneMinusMu).mul(0.32))
      .clamp(0.28, 1)
    // Realistic 18% RMS thermal contrast:
    // Sinking lanes: ~5,100K deep amber-red (#801a00 to #b83c02)
    // Convective dome plateaus: ~5,900K rich solar gold (#f29618)
    // Upwelling crests: ~6,350K warm golden white (#ffeaa4)
    const k5100 = color(hsl.integer(34, 100, 29))
    const k5600 = color(hsl.integer(41, 98, 50))
    const k5900 = color(hsl.integer(66, 96.7, 71))
    const k6350 = color(hsl.integer(94, 100, 93))
    const laneThermal = mix(k5100, k5600, cellConvection.mul(0.35))
    const plateauThermal = mix(laneThermal, k5900, cellConvection.add(microTurbulence).clamp(0, 1))
    const thermalCore = mix(plateauThermal, k6350, cellConvection.pow(1.8).mul(supergranulation).mul(0.55))
    // Base color absorbs all external diffuse light
    this.colorNode = color(hsl.integer(0, 0, 0))
    // Solar radiant emissions:
    // 1. Photospheric blackbody radiation
    const photosphericEmission = thermalCore
      .mul(limbDarkening)
      .mul(supergranulation.mul(0.25).add(0.85))
      .mul(2.3)
    // 2. Magnetic bright points (DKIST signature): concentrated flux tubes at multi-lane junction vertices
    const junctionVertex = laneMask.mul(d1.smoothstep(0.35, 0.65))
    const pointNoise = mx_noise_float(granuleCoord.mul(4)).smoothstep(0.55, 0.85)
    const magneticPoints = junctionVertex.mul(pointNoise)
    const magneticGlow = color(hsl.integer(99, 100, 99)).mul(magneticPoints).mul(near.mul(0.6).add(0.4)).mul(3.2)
    // 3. Chromospheric corona: thin energetic H-alpha atmospheric fringe at the grazing limb
    const chromosphericHalo = color(hsl.integer(34, 100, 59.5))
      .mul(rim.pow(2))
      .mul(1.2)
    // 4. Intimate micro-reconnection boiling revealed up close
    const spiculeChurn = mx_noise_float(p.mul(45).add(vec3(0, time.mul(0.9), 0)))
      .smoothstep(0.6, 0.95)
      .mul(laneMask)
      .mul(intimate)
    const spiculeGlow = color(hsl.integer(86, 100, 85)).mul(spiculeChurn).mul(1.5)
    this.emissiveNode = photosphericEmission
      .add(magneticGlow)
      .add(chromosphericHalo)
      .add(spiculeGlow)
  }
}
