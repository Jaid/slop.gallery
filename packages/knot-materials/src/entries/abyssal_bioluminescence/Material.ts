import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 2. ABYSSAL BIOLUMINESCENCE Cryo-glacial hadal glass holding living siphonophore colonies. Dual travelling neuro-electrical action-potential spikes surge across the knot loops in real-time, refracting through deep oceanic indigo-blue dispersion and multi-depth organ clusters. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    const tube = uv()
    this.transmission = 0.94
    this.thickness = 0.72
    this.ior = 1.34
    this.dispersion = 0.42
    this.attenuationColor.set(hsl.integer(244, 88, 9))
    this.attenuationDistance = 0.35
    this.roughness = 0.02
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // Interior parallax depth coordinates
    const deep1 = p.sub(view.mul(0.14))
    const deep2 = p.sub(view.mul(0.28))
    // Travelling action-potential neural waves
    const pulse1 = tube.x.mul(14).sub(time.mul(1.5)).fract()
    const nerveSpike1 = pulse1.smoothstep(0, 0.06).mul(pulse1.smoothstep(0.06, 0.28).oneMinus()).pow(1.5)
    const pulse2 = tube.x.mul(-9).sub(time.mul(0.95)).fract()
    const nerveSpike2 = pulse2.smoothstep(0, 0.07).mul(pulse2.smoothstep(0.07, 0.32).oneMinus()).pow(1.5)
    // Internal bioluminescent organ filaments & glowing colonial spores
    const organNoise = mx_noise_float(deep1.mul(15))
    const filaments = opticalLine(organNoise.mul(16).sin(), 0.045)
    const sporeSample = deep2.mul(30)
    const spores = cellNoiseVec3(sporeSample)
    // Per-spore brightness only contributes inside a compact, round inclusion.
    const sporeGlow = cellularPoints(sporeSample, 0.06, 0.24, 0.35).mul(spores.y).mul(intimate)
    const colorCyan = color(hsl.integer(173, 100, 87))
    const colorPink = color(hsl.integer(3, 100, 58.7))
    const colorIndigo = color(hsl.integer(300, 89, 41))
    const waveTint = mix(colorCyan, colorPink, nerveSpike1.add(nerveSpike2.mul(0.5)).clamp())
    this.colorNode = color(hsl.integer(237, 75, 5))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(22)).mul(0.12), 0.0012)
    const organGlow = filaments.mul(colorCyan).mul(1.6).add(sporeGlow.mul(colorPink).mul(3.2))
    const waveGlow = waveTint.mul(nerveSpike1.mul(3.8).add(nerveSpike2.mul(2.4)))
    this.emissiveNode = organGlow.add(waveGlow).mul(near.mul(0.7).add(0.5)).add(colorIndigo.mul(rim).mul(0.25))
  }
}
