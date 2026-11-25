import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {hexLattice} from '../../candidates/gemini_flash/lib/hexLattice.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {p, rim, near} = viewerFrame()
    // Hexagonal Abrikosov flux lattice mapped along the knot surface
    const gridScale = vec2(36, 12)
    const {local, edgeDist, radius} = hexLattice(tube.mul(gridScale))
    // Vortex core: order parameter collapses at r = 0
    const core = radius.smoothstep(0.04, 0.16).oneMinus()
    const hexFacet = edgeDist.smoothstep(0.01, 0.08).oneMinus()
    // Quantum phase angle around the vortex core
    const theta = mx_atan2(local.y, local.x.add(0.00001)) as unknown as Node<'float'>
    // Concentric Meissner quantum phase rings expanding from each vortex
    const phaseRings = radius.mul(Math.PI * 18).sub(time.mul(1.8)).add(theta.mul(0.5)).sin()
      .smoothstep(0.2, 0.85)
      .mul(radius.smoothstep(0.08, 0.45).oneMinus())
    // Substrate: dark crystalline cuprate ceramic with cleavage steps
    const ceramicNoise = mx_noise_float(p.mul(28)).mul(0.12).add(0.88)
    const ceramicBase = mix(color(hsl.integer(275, 25, 5)), color(hsl.integer(273, 37, 10)), ceramicNoise)
    const currentStreamline = mix(color(hsl.integer(220, 72, 18)), color(hsl.integer(212, 82, 34)), phaseRings)
    this.colorNode = mix(ceramicBase, currentStreamline, core.mul(0.3).add(phaseRings.mul(0.4)))
    this.metalnessNode = float(0.82).sub(core.mul(0.5))
    this.roughnessNode = float(0.18).sub(core.mul(0.1)).add(hexFacet.mul(0.08))
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.03
    // Vortex depression and circulating current normal
    const vortexNormal = proceduralNormal(core.mul(-0.004).add(phaseRings.mul(0.0015)), 0.8)
    this.normalNode = vortexNormal
    // Superconducting emissions:
    // 1. Vortex core singularity: piercing electric cyan to ultraviolet
    const coreEmission = mix(color(hsl.integer(202, 100, 85)), color(hsl.integer(302, 99, 53.6)), core.pow(2))
      .mul(core)
      .mul(near.mul(0.5).add(0.7))
      .mul(2.8)
    // 2. Meissner shielding currents: pulsing quantum phase ripples
    const ringEmission = color(hsl.integer(171, 100, 87))
      .mul(phaseRings)
      .mul(near.mul(0.6).add(0.4))
      .mul(0.8)
    // 3. Lattice boundary luminescence
    const latticeAura = color(hsl.integer(289, 74, 30)).mul(hexFacet).mul(0.35)
    // 4. Diamagnetic rim shielding
    const diamagneticRim = color(hsl.integer(231, 100, 71.6)).mul(rim.pow(2.5)).mul(0.5)
    this.emissiveNode = coreEmission
      .add(ringEmission)
      .add(latticeAura)
      .add(diamagneticRim)
  }
}
