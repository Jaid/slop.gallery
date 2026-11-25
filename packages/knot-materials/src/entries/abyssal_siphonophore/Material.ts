import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, normalViewGeometry, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Eight longitudinal comb rows running along the knot tube
    const combY = tube.y.mul(8)
    const combDist = combY.fract().sub(0.5).abs()
    const combFootprint = combY.fwidth().max(0.0001)
    const inRow = combDist.smoothstep(0.02, combFootprint.mul(1.2).add(0.06)).oneMinus()
    // Rapid rhythmic micro-cilia beating waves traveling down the comb lines
    const ciliaPhase = tube.x.mul(TAU * 15).sub(time.mul(4.2)).add(combY.floor().mul(TAU / 4))
    const beating = ciliaPhase.sin().smoothstep(0.1, 0.85)
    // Diffraction grating: angle of incidence along the comb line produces iridescent rainbow colors
    // Give the slow rainbow its own whole cycle; scaling the cilia phase breaks the UV wrap.
    const rainbowPhase = tube.x.mul(TAU).add(combY.floor().mul(TAU * 0.015)).sub(time.mul(0.102))
    const combAngle = view.dot(normalLocal.normalize()).abs().mul(6).add(rainbowPhase)
    const diffraction = spectralColor(combAngle)
    // Internal volumetric photophore organs: sampled at successive chord depths
    const dir = view.negate()
    const chord = facing.mul(0.22).add(0.02)
    const organDrift = vec3(0, time.mul(0.04), time.mul(-0.02))
    const steps = 6
    let internalGlow: Node<'vec3'> = vec3(0)
    let absorption: Node<'float'> = float(1)
    for (let i = 0; i < steps; i++) {
      const depth = (i + 0.5) / steps
      const q = p.add(dir.mul(chord.mul(depth)))
      const organNoise = mx_noise_float(q.mul(9).add(organDrift))
      const fineNoise = mx_noise_float(q.mul(22).sub(organDrift.mul(1.6)))
      const density = organNoise.add(fineNoise.mul(0.35)).smoothstep(0.3, 0.7)
      const organTint = mix(color(hsl.integer(202, 100, 85)), color(hsl.integer(300, 89, 41)), float(depth).mul(0.7).add(organNoise.mul(0.3)).clamp())
      internalGlow = internalGlow.add(organTint.mul(density).mul(absorption).mul(0.7 + (1 - Math.abs(depth - 0.5) * 2) * 0.8))
      absorption = absorption.mul(density.mul(0.45).oneMinus().clamp())
    }
    // Deep bioluminescent vesicle inclusions that awaken when the viewer draws close
    const vesicles = cellularPoints(p.sub(view.mul(0.1)).mul(48), 0.02, 0.18, 0.65).mul(intimate)
    // Defensive bioluminescent waves rushing along the knot on close encounter
    const defensePhase = tube.x.mul(TAU * 3).sub(time.mul(2.2)).sin()
    const defenseWave = defensePhase.smoothstep(0.72, 0.98)
    const defenseTint = mix(color(hsl.integer(165, 100, 86.7)), color(hsl.integer(304, 81, 52.6)), tube.x.mul(TAU).sin().mul(0.5).add(0.5))
    // Cilia glints and micro-shimmer
    const ciliaNormal = normalViewGeometry.add(diffraction.sub(0.5).mul(0.4)).normalize()
    const ciliaSparkle = glints(ciliaNormal, 90).mul(inRow).mul(beating).mul(near.mul(0.7).add(0.3))
    // Translucent marine body
    const bodyTint = mix(color(hsl.integer(240, 61, 10)), color(hsl.integer(234, 71, 21)), grazing.mul(0.6))
    this.colorNode = bodyTint
    this.transmission = 0.93
    this.thickness = 0.78
    this.ior = 1.334
    this.dispersion = 0.35
    this.attenuationColor.set(hsl.integer(231, 76, 21))
    this.attenuationDistance = 1.3
    this.roughness = 0.038
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // Thin-film gelatinous iridescence on grazing outer skin
    this.iridescence = 0.4
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = grazing.mul(240).add(300)
    // Micro-ridges for the comb rows in the surface normal
    const combRidge = inRow.mul(ciliaPhase.sin().mul(0.002).add(0.003))
    this.normalNode = proceduralNormal(combRidge, 0.6)
    // Composite emissive radiation: comb rainbow diffraction + internal photophores + defensive pulses + vesicles
    const combEmission = diffraction.mul(inRow).mul(beating.mul(0.75).add(0.25)).mul(2.4)
    const photophoreEmission = internalGlow.div(steps).mul(3.2).mul(near.mul(0.5).add(0.6))
    const defenseEmission = defenseTint.mul(defenseWave).mul(intimate).mul(2.8)
    const vesicleEmission = color(hsl.integer(212, 100, 90)).mul(vesicles).mul(2)
    const rimGlow = color(hsl.integer(248.8, 100, 61.5)).mul(rim.pow(3)).mul(0.35)
    this.emissiveNode = combEmission
      .add(photophoreEmission)
      .add(defenseEmission)
      .add(vesicleEmission)
      .add(ciliaSparkle.mul(color(hsl.integer(197, 99, 96))).mul(1.5))
      .add(rimGlow)
  }
}
