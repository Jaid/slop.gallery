import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
// 8 longitudinal ctenophore comb rows (ctenes) running around the knot tube
    const combPhase = tube.y.mul(Math.PI * 16)
    const combBand = combPhase.cos().pow(12)
// Metachronal running waves of prismatic structural light diffraction
    const wavePhase = tube.x.mul(36).sub(time.mul(2.4)).add(tube.y.mul(6))
    const diffractionHue = wavePhase.mul(0.16).add(facing.mul(0.8)).add(grazing.mul(0.5))
    const rainbowDiffraction = cosinePalette(diffractionHue, [0.5, 0.5, 0.5], [0.48, 0.48, 0.48], [1, 1, 1], [0, 0.33, 0.67])
// Glowing comb plates that ripple along the rows
    const activeComb = combBand.mul(rainbowDiffraction)
// Deep bioluminescent photophores (internal glandular light organs)
    const organGrid = vec2(tube.x.mul(14), tube.y.mul(4))
    const organUv = organGrid.fract().sub(0.5)
    const organDist = organUv.length()
    const isOrgan = organDist.smoothstep(0.24, 0.06)
// Organic breathing pulse of luciferin illumination
    const breath = time.mul(1.4).sin().mul(0.35).add(0.65)
    const organPulse = isOrgan.mul(breath).mul(near.mul(0.8).add(0.5))
// Trailing nematocyst tentilla (fine glowing filament threads)
    const spiral1 = tube.x.mul(28).add(tube.y.mul(14)).add(time.mul(0.35)).sin()
    const spiral2 = tube.x.mul(20).sub(tube.y.mul(18)).sub(time.mul(0.28)).sin()
    const tentacle1 = spiral1.abs().smoothstep(0.042, 0.005)
    const tentacle2 = spiral2.abs().smoothstep(0.038, 0.005)
    const tentacles = tentacle1.add(tentacle2).clamp().mul(near.mul(0.7).add(0.3))
// Soft gelatinous body noise
    const jellyWarp = mx_noise_float(p.mul(4.5).add(vec3(0, time.mul(0.05), 0)))
// Physical properties: highly transmissive deep-sea pelagic mesoglea
    this.transmission = 0.95
    this.thickness = 0.92
    this.ior = 1.34
    this.dispersion = 0.55
    this.attenuationColor.set(hsl.integer(186, 99, 84))
    this.attenuationDistance = 1.6
    this.colorNode = mix(color(hsl.integer(227, 61, 12)), color(hsl.integer(226, 74, 27)), jellyWarp.mul(0.5).add(0.5))
    this.metalness = 0.05
    this.roughnessNode = float(0.12).sub(combBand.mul(0.06)).add(tentacles.mul(0.04))
// Watery high gloss clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.8
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = combBand.mul(320).add(180)
// Procedural normal mapping for comb ridges and tentacle tracks
    const relief = combBand.mul(0.0035).add(tentacles.mul(0.0015)).add(jellyWarp.mul(0.001))
    this.normalNode = proceduralNormal(relief, 0.85)
// Deep ocean bioluminescent emission
    const luciferinTeal = color(hsl.integer(162, 98.4, 86))
    const photophoreViolet = color(hsl.integer(295, 94, 46))
    const organColor = mix(luciferinTeal, photophoreViolet, organUv.x.mul(0.5).add(0.5))
    const tentacleCyan = color(hsl.integer(209, 100, 83.6))
    this.emissiveNode = activeComb.mul(2.6)
      .add(organColor.mul(organPulse).mul(3.2))
      .add(tentacleCyan.mul(tentacles).mul(1.5))
      .add(luciferinTeal.mul(facing.pow(2)).mul(isOrgan).mul(1.2))
      .add(color(hsl.integer(202.92, 100, 84.9)).mul(rim).mul(grazing.pow(2)).mul(0.45))
      .add(color(hsl.integer(265.2, 100, 45.5)).mul(intimate).mul(0.15))
  }
}
