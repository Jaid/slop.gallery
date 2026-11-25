import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Ultra-black velvet whose microscopic nap flows across the surface like windblown grass. Most of it consumes light, while grazing angles ignite moving silver or deep crimson halos. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    // Nap flow field — drifting noise that creates the sense of wind over fabric
    const flowDrift = vec3(time.mul(0.02), time.mul(-0.015), time.mul(0.01))
    const flowA = mx_noise_float(p.mul(4).add(flowDrift))
    const flowB = mx_noise_float(p.mul(7).sub(flowDrift.mul(1.5)).add(11.7))
    const fiberCluster = mx_noise_float(p.mul(28)).mul(0.5).add(0.5)
    // Fiber texture visible at closer range
    const fiberNoise = mx_noise_float(p.mul(48)).mul(0.5).add(0.5)
    // Nap height for micro-normal perturbation
    const napHeight = flowA.mul(0.35).add(flowB.mul(0.15)).add(fiberNoise.mul(near).mul(0.12))
    // The "eclipse" effect — grazing angles produce dramatic halos
    const silverBand = grazing.smoothstep(0.45, 0.72).mul(grazing.smoothstep(0.92, 0.82))
    const crimsonBand = grazing.smoothstep(0.75, 0.96)
    // Nap catches light differently — wave-like patterns
    const napWave = mx_noise_float(p.mul(8).add(flowDrift.mul(8))).mul(0.5).add(0.5)
    const napCatchLight = napWave.pow(3).mul(grazing.pow(2)).mul(near.mul(0.6).add(0.4))
    // View-dependent nap alignment
    const napAlignment = flowA.mul(0.5).add(0.5).mul(grazing)
    // Base color: ultra-dark, barely distinguishable from black
    const baseColor = mix(
      color(hsl.integer(284, 27, 2)),
      color(hsl.integer(285, 14, 6)),
      fiberCluster.mul(0.3).add(napCatchLight.mul(0.15)),
    )
    // Halo colors
    const silverColor = color(hsl.integer(286, 17, 81))
    const crimsonColor = color(hsl.integer(15, 88, 32))
    const goldColor = color(hsl.integer(86, 62, 59))
    const haloIntensity = silverBand.mul(0.35).add(crimsonBand.mul(0.25)).add(napAlignment.mul(0.05))
    const haloColor = mix(
      silverColor,
      mix(crimsonColor, goldColor, napAlignment.mul(0.3)),
      crimsonBand.div(crimsonBand.add(silverBand).max(0.001)),
    )
    this.colorNode = mix(baseColor, haloColor, haloIntensity.mul(0.15))
    // Extremely rough — velvet absorbs almost all light
    this.roughnessNode = float(0.95).sub(grazing.pow(3).mul(0.35)).clamp(0.55, 0.98)
    this.metalness = 0
    // Strong sheen — this is the primary visual driver of the velvet look
    this.sheen = 1
    this.sheenColor.set(hsl.integer(286, 17, 81))
    this.sheenRoughness = 0.28
    // Subtle normal perturbation from the fiber nap
    this.normalNode = proceduralNormal(napHeight, 0.0006)
    // Slight displacement to give fiber texture
    const displacement = napHeight.mul(near.mul(0.5).add(0.3)).mul(0.002)
    this.positionNode = positionGeometry.add(normalLocal.mul(displacement))
    // Emissive — the eclipse halos glow at the edges
    const silverGlow = silverBand.mul(napCatchLight)
    const crimsonGlow = crimsonBand.pow(2)
    // Traveling light wave along the nap
    const wavePhase = p.dot(vec3(0.6, 0.3, 0.7).normalize().mul(12)).add(time.mul(0.8))
    const wavePulse = wavePhase.sin().mul(0.5).add(0.5).pow(8).mul(grazing.pow(3)).mul(intimate)
    // Edge glow
    const eclipseGlow = grazing.pow(4).mul(facing.smoothstep(0, 0.15))
    this.emissiveNode = silverColor.mul(silverGlow).mul(0.6)
      .add(color(hsl.integer(22, 100, 58)).mul(crimsonGlow).mul(0.45))
      .add(goldColor.mul(eclipseGlow).mul(0.2))
      .add(color(hsl.integer(15, 100, 59.7)).mul(wavePulse).mul(0.3))
  }
}
