import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    this.envMapIntensity = 0.72
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
    // A handful of depth slices make the resin feel inhabited. Their parallax is deliberately small at
    // a distance and becomes undeniable when the visitor leans close to the knot.
    const steps = 6
    let suspended: Node<'vec3'> = vec3(0)
    let density: Node<'float'> = float(0)
    for (let index = 0;index < steps;index++) {
      const depth = (index + 0.5) / steps
      const q = p.sub(view.mul(depth * 0.26)).add(vec3(depth * 0.07, depth * -0.035, depth * 0.045))
      const cloud = mx_fractal_noise_float(q.mul(4.3).add(vec3(time.mul(0.018), time.mul(-0.012), time.mul(0.009))), 3, 2.05, 0.55).mul(0.5).add(0.5)
      const fern = opticalLine(mx_noise_float(q.mul(10.5).add(vec3(4.1, -7.3, 12.8))).add(q.dot(vec3(2.1, -1.4, 3.2)).sin().mul(0.22)), 0.02)
      const thread = opticalLine(mx_noise_float(q.mul(19).add(vec3(-8.5, 3.2, 5.4))), 0.014).mul(near.mul(0.8).add(0.2))
      const layer = fern.mul(0.68).add(thread.mul(0.42)).mul(cloud.mul(0.7).add(0.3))
      const tint = mix(color(hsl.integer(42, 92, 36)), color(hsl.integer(82, 89, 79)), cloud.mul(0.7).add(grazing.mul(0.3)).clamp())
      suspended = suspended.add(tint.mul(layer).mul(0.72 + (1 - depth) * 0.42))
      density = density.add(layer)
    }
    const innerVeil = suspended.div(steps)
    const amberCloud = mx_fractal_noise_float(p.mul(3.2).add(vec3(2.4, -1.2, 5.1)), 4, 2, 0.52).mul(0.5).add(0.5)
    const pollen = cellularPoints(p.sub(view.mul(0.14)).mul(43), 0.026, 0.17, 0.62).mul(near.mul(0.86).add(0.34))
    const pollenPulse = p.dot(vec3(5.1, -2.8, 4.6)).mul(5).add(time.mul(0.42)).sin().mul(0.5).add(0.5).pow(7)
    const pollenGold = pollen.mul(pollenPulse.mul(0.72).add(0.42)).clamp()
    const bubble = cellularPoints(p.sub(view.mul(0.23)).mul(18), 0.055, 0.23, 0.52).mul(near.mul(0.6).add(0.2))
    const trappedShadow = mx_noise_float(p.sub(view.mul(0.22)).mul(25).add(vec3(11.2, 1.9, -6.7))).smoothstep(0.7, 0.91).mul(near)
    const resin = mix(color(hsl.integer(36, 86, 8.6)), color(hsl.integer(59, 93, 61.5)), amberCloud.mul(0.54).add(facing.mul(0.28)).clamp())
    const depthColor = mix(resin, mix(color(hsl.integer(37, 87, 25)), color(hsl.integer(75, 90, 75)), grazing), density.div(steps).mul(0.42).clamp())
    const fossilGlow = mix(color(hsl.integer(40, 91, 28)), color(hsl.integer(80, 90, 79)), density.div(steps).mul(0.7).add(grazing.mul(0.3)).clamp())
    const surface = mix(depthColor, fossilGlow, density.div(steps).mul(0.24).clamp())
    const fossil = mix(surface, color(hsl.integer(5, 35, 5)), trappedShadow.mul(0.38))
    const relief = pollen.mul(0.0015).add(bubble.mul(0.0007)).add(amberCloud.mul(near).mul(0.00035))
    this.colorNode = mix(mix(fossil, color(hsl.integer(74, 94, 76)), pollenGold.mul(0.72)), color(hsl.integer(91, 100, 89.7)), bubble.mul(0.25))
    this.metalness = 0.02
    this.roughnessNode = float(0.105).add(trappedShadow.mul(0.12)).add(bubble.mul(0.04)).sub(grazing.mul(0.028)).clamp(0.025, 0.28)
    this.transmission = 0.78
    this.thickness = 0.48
    this.ior = 1.54
    this.dispersion = 0.24
    this.attenuationColor.set(hsl.integer(50, 96, 57))
    this.attenuationDistance = 0.92
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.028
    this.positionNode = p.add(normalLocal.mul(amberCloud.mul(0.00065)))
    this.normalNode = proceduralNormal(relief.add(innerVeil.x.mul(0.0004)), 0.48)
    this.emissiveNode = color(hsl.integer(82, 100, 82.7)).mul(pollenGold).mul(intimate.mul(1.15).add(0.32)).add(color(hsl.integer(56, 100, 71)).mul(bubble).mul(0.32)).add(color(hsl.integer(44, 100, 65.4)).mul(grazing.pow(4)).mul(0.1))
  }
}
