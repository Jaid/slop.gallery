import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {
  color,
  mix,
  mx_noise_float,
  normalViewGeometry,
  time,
  uv,
  vec2,
  vec3,
} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    // 1. Subsurface Refractive Parallax into the Reactor Pool (Heavy Water D2O)
    const poolDepth = 0.042
    const q = p.sub(view.mul(poolDepth))
    // 2. Submerged Hexagonal Zircaloy Fuel Pin Lattice
    const latticeScale = 22
    const fuelGrid = vec2(q.x.mul(latticeScale), q.y.mul(latticeScale))
    const fuelLocal = fuelGrid.fract().sub(0.5)
    const pinRadius = fuelLocal.length()
    const fuelPin = pinRadius.smoothstep(0.32, 0.26) // Cylindrical fuel rod pins
    const gridSpacer = fuelLocal.abs().x.max(fuelLocal.abs().y).smoothstep(0.44, 0.48) // Inconel grid spacer
    // Zircaloy-4 cladding metallic luster
    const zircaloyBase = color(hsl.integer(221, 13, 51))
    const gridSpacerColor = color(hsl.integer(218, 12, 35))
    const reactorStructure = mix(zircaloyBase, gridSpacerColor, gridSpacer)
    // Water channel between fuel pins (flow channel)
    const waterPoolBase = color(hsl.integer(257, 53, 6))
    const submergedInterior = mix(waterPoolBase, reactorStructure, fuelPin.add(gridSpacer))
    // 3. Frank-Tamm Cherenkov Radiation Physics:
    // Emission intensity scales as 1/lambda^3, peaking intensely in the near-UV and violet-blue (380-450 nm)
    const uvViolet = color(hsl.integer(273.3, 100, 39))
    const electricCobalt = color(hsl.integer(263.5, 100, 43.6))
    const cherenkovCyan = color(hsl.integer(226, 100, 74))
    const promptCriticalWhite = color(hsl.integer(237, 100, 95.6))
    // Cherenkov glow radiates primarily from the fuel pin surfaces into the coolant
    const pinBoundary = pinRadius.sub(0.28).abs().smoothstep(0.12, 0.01)
    // Prompt-critical shockwaves propagating along the reactor core
    const waveTime = time.mul(0.7)
    const shockPhase = tube.x.mul(TAU * 6).sub(waveTime)
    const shockwave = shockPhase.sin().smoothstep(0.75, 0.96)
    const corePulse = time.mul(0.4).sin().mul(0.18).add(0.82)
    // Combined Cherenkov spectrum
    const cherenkovSpectrum = mix(
      uvViolet,
      mix(electricCobalt, cherenkovCyan, pinBoundary.smoothstep(0.2, 0.8)),
      shockwave.mul(0.6).add(0.2),
    )
    // High-energy ionizing radiation glow
    const cherenkovEmission = cherenkovSpectrum
      .mul(pinBoundary.mul(1.4).add(fuelPin.mul(0.6)).add(shockwave.mul(1.2)))
      .mul(corePulse)
      .mul(near.mul(0.5).add(0.8))
    // 4. Submerged Ionized Radiolytic Micro-Bubbles
    const bubbleCoord = q.mul(65).add(vec3(0, time.mul(0.15), 0))
    const bubbleMask = cellularPoints(bubbleCoord, 0.03, 0.16, 0.72)
    const bubbleGlint = glints(normalViewGeometry, 80).mul(bubbleMask).mul(intimate)
    // 5. Convective Thermal Fluid Wake on the Water Surface
    const thermalWake = mx_noise_float(p.mul(10).add(vec3(0, time.mul(0.35), 0))).mul(0.0003)
    this.normalNode = proceduralNormal(thermalWake, 0.8)
    // Physical Heavy Water (D2O) Optical Transmission Properties
    this.colorNode = submergedInterior
    this.transmission = 0.72
    this.thickness = 0.52
    this.ior = 1.333 // Pure heavy water
    this.dispersion = 0.1 // Chromatic aberration through water volume
    this.attenuationColor.set(hsl.integer(251, 80, 25)) // Selective red-absorption of pure heavy water
    this.attenuationDistance = 0.88
    this.roughness = 0.035
    // Glassy liquid surface clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    // Cherenkov Luminescent Emission
    this.emissiveNode = cherenkovEmission
      .mul(3.6)
      .add(promptCriticalWhite.mul(shockwave.pow(2)).mul(2.2))
      .add(color(hsl.integer(0, 0, 100)).mul(bubbleGlint).mul(2))
      .add(uvViolet.mul(grazing.pow(2.5)).mul(0.35))
      .add(cherenkovCyan.mul(fuelPin).mul(intimate).mul(1.2))
  }
}
