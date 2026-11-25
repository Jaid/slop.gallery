import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Fade unresolved grain to its period average, consistently across all material channels. */
function filteredGrain(phase: Node<'float'>, inner: number, outer: number, average: number) {
  const visibility = phase.fwidth().smoothstep(0.3, 1.5).oneMinus()
  const grain = phase.sin().abs().smoothstep(inner, outer).oneMinus()
  return mix(float(average), grain, visibility)
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.96)
    this.name = knotData.id
    this.envMapIntensity = 0.96
    const p = positionGeometry
    const {view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const grainWarp = mx_fractal_noise_float(vec3(p.x.mul(2.1), p.y.mul(2.1), p.z.mul(2.1)).add(vec3(tube.x.mul(TAU).sin().mul(0.35).add(0.35), tube.y.mul(TAU).sin().mul(0.15).add(0.15), 0)), 3, 2.06, 0.5)
    const annual = p.x.mul(15.7).add(p.y.mul(7.4)).sub(p.z.mul(5.1)).add(grainWarp.mul(2.7))
    const ringPhase = annual.mul(18.5).add(grainWarp.mul(0.8))
    // Period averages of the smooth zero-crossing profiles, not their peak values.
    const ring = filteredGrain(ringPhase, 0.08, 0.46, 0.174752597)
    const lateWood = filteredGrain(ringPhase, 0.03, 0.28, 0.099236287)
    const fiberPhase = p.x.mul(210).add(p.y.mul(31)).sub(p.z.mul(18)).add(grainWarp.mul(7))
    const fiber = filteredGrain(fiberPhase, 0.08, 0.48, 0.181488018)
    const poreNoise = mx_noise_float(p.mul(96).add(2.7)).abs()
    const pore = poreNoise.smoothstep(0.025, 0.16).oneMinus().mul(intimate)
    const chatAxis = vec3(0.72, 0.18, 0.67).normalize()
    const chatoyance = view.dot(chatAxis).abs().pow(3).mul(grazing.mul(0.65).add(0.35))
    const lateColor = mix(color(hsl.integer(24, 60, 10.5)), color(hsl.integer(50, 78, 47.5)), lateWood.mul(0.58).add(0.12))
    const earlyColor = mix(color(hsl.integer(11, 22, 6)), color(hsl.integer(34, 71, 22)), ring.mul(0.38).add(0.2))
    const wood = mix(earlyColor, lateColor, grainWarp.mul(0.18).add(0.48)).mul(fiber.mul(0.12).add(0.88))
    this.colorNode = mix(wood, color(hsl.integer(63, 72, 64)), chatoyance.mul(0.24)).mul(pore.mul(-0.12).add(1))
    this.metalness = 0.03
    this.roughnessNode = float(0.34).add(ring.mul(0.075)).sub(fiber.mul(0.12)).sub(chatoyance.mul(0.09)).add(pore.mul(0.12)).clamp(0.14, 0.62)
    this.anisotropy = 0.88
    this.anisotropyNode = vec2(0.84, 0.08)
    this.clearcoat = 0.48
    this.clearcoatRoughnessNode = float(0.16).add(pore.mul(0.12)).sub(chatoyance.mul(0.045))
    this.sheen = 0.16
    this.sheenColor.set(hsl.integer(71, 100, 87))
    this.sheenRoughness = 0.3
    this.iridescenceNode = chatoyance.mul(0.12)
    this.iridescenceThicknessNode = view.dot(chatAxis).mul(100).add(230)
    const relief = ring.mul(0.0018).add(lateWood.mul(0.0011)).add(fiber.mul(0.00035)).add(pore.mul(-0.00025))
    this.normalNode = proceduralNormal(relief.mul(2.2), 0.8)
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = float(1).sub(pore.mul(0.22)).sub(ring.mul(0.05))
    const movingLight = annual.mul(0.08).sub(time.mul(0.045)).sin().mul(0.5).add(0.5).pow(9)
    this.emissiveNode = color(hsl.integer(68, 75, 72.4)).mul(chatoyance).mul(movingLight).mul(near.mul(0.16).add(0.035))
      .add(color(hsl.integer(76, 100, 88)).mul(fiber).mul(chatoyance).mul(intimate.mul(0.05)))
      .add(color(hsl.integer(35, 80, 28)).mul(pore).mul(0.012))
  }
}
