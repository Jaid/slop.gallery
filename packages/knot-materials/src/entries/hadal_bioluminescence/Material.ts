import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {
  color,
  float,
  mix,
  mx_noise_float,
  time,
  uv,
  vec2,
  vec3,
} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7) // Soft oceanic reflections
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    // 1. Ctenophore Comb Rows: 8 longitudinal ciliated bands running along the knot
    const combTracks = tube.y.mul(8)
    const ribDist = combTracks.fract().sub(0.5).abs()
    const combRib = ribDist.smoothstep(0.12, 0.02) // Width of each ciliated comb row
    // Metachronal wave: coordinated cilia beating propagates along the knot at ~1.8 Hz
    const beatPhase = tube.x.mul(TAU * 18).sub(time.mul(2.2))
    const ciliaMotion = beatPhase.sin().mul(0.5).add(0.5)
    // Dynamic structural color diffraction: the beating micro-cilia disperse light into running rainbows
    const diffractionPhase = beatPhase.mul(0.8).add(tube.y.mul(TAU * 2)).add(grazing.mul(TAU))
    const runningRainbow = spectralColor(diffractionPhase)
    // Ciliated comb row diffraction emission
    const ciliaDispersal = runningRainbow
      .mul(combRib)
      .mul(ciliaMotion.mul(0.7).add(0.3))
      .mul(near.mul(0.4).add(0.8))
    // 2. Bioluminescent Photophores (Living Light Organs with Reflector Lenses)
    // Symmetrical arrays along the organism's lateral tracks
    const organGrid = vec2(tube.x.mul(32), tube.y.mul(4))
    const organLocal = organGrid.fract().sub(0.5)
    const organRadius = organLocal.length()
    // Photophore lens anatomy: reflective tapetum ring and central emitter core
    const photophoreCore = organRadius.smoothstep(0.24, 0.08)
    const reflectorRing = organRadius.sub(0.22).abs().smoothstep(0.06, 0.01)
    // Neural action potential: rhythmic waves of bioluminescent excitation traveling the nerve net
    const neuralTime = time.mul(1.4)
    const neuralWave = tube.x.mul(TAU * 2.5).sub(neuralTime).sin().smoothstep(0.2, 0.95)
    const neuralEmerald = color(hsl.integer(152.6, 100, 85.6))
    const deepCobalt = color(hsl.integer(263.5, 100, 43.6))
    const photophoreColor = mix(deepCobalt, neuralEmerald, neuralWave)
    // Photophore organ emission
    const photophoreFlash = photophoreColor
      .mul(photophoreCore)
      .mul(neuralWave.mul(2.2).add(0.5))
    // 3. Gelatinous Dermis and Translucent Internal Gut
    // Subsurface internal parallax ray into the organism's coelenteron
    const qInternal = p.sub(view.mul(0.038))
    const gutTurbulence = mx_noise_float(qInternal.mul(6).add(vec3(0, time.mul(0.08), 0)))
      .mul(0.5)
      .add(0.5)
    const deepOrganGlow = color(hsl.integer(263.5, 100, 22))
      .mul(gutTurbulence)
      .mul(near.mul(0.6).add(0.3))
    // 4. Velvet Ultra-Black Epidermal Skin
    // Ultra-low reflectivity protects against predator photophore reflection
    const ultraBlackSkin = color(hsl.integer(284, 27, 2))
    const reflectorSilver = color(hsl.integer(214, 23, 63))
    const epidermis = mix(ultraBlackSkin, reflectorSilver, reflectorRing.mul(0.85))
    // 5. Bioluminescent Micro-Pores (Sub-millimeter Photocytes)
    const poreCoord = p.mul(75).add(vec3(0, time.mul(0.12), 0))
    const porePoints = cellularPoints(poreCoord, 0.03, 0.18, 0.68)
    const poreSparkle = color(hsl.integer(187, 100, 88)).mul(porePoints).mul(intimate.mul(0.8).add(0.4))
    // Surface PBR properties: slimy aquatic gelatinous envelope
    this.colorNode = epidermis
    this.metalnessNode = reflectorRing.mul(0.8)
    this.roughnessNode = mix(float(0.08), float(0.35), reflectorRing)
    // Gelatinous translucent body
    this.transmission = 0.48
    this.thickness = 0.38
    this.ior = 1.34 // Hydrated biological tissue
    this.attenuationColor.set(hsl.integer(252, 73, 8))
    this.attenuationDistance = 0.75
    // Glassy aquatic mucous clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.018
    // Bioluminescent self-emission: running rainbow cilia, neural photophores, and deep gut glow
    this.emissiveNode = ciliaDispersal
      .mul(3.4)
      .add(photophoreFlash.mul(4.2))
      .add(deepOrganGlow.mul(1.5))
      .add(poreSparkle.mul(2.5))
      .add(color(hsl.integer(263, 100, 29.5)).mul(grazing.pow(2.8)).mul(0.3))
  }
}
