import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {fractalNoise, ridgedNoise} from '../../candidates/grok/lib/fractalNoise.ts'
import {palette} from '../../candidates/grok/lib/palette.ts'
import {screenRibbon} from '../../candidates/grok/lib/screenRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Pressed glacier ice. Annual strata are object-space sheets, so walking around reveals new seasons through the tube. Hairline fractures catch the studio like cut crystal, and trapped air only resolves when the camera comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate, distance} = viewerFrame()
    const strataPhase = p.dot(vec3(0.7, -9.2, 1.4)).add(mx_noise_float(p.mul(2.4)).mul(0.85))
    const strata = strataPhase.mul(3.1).sin()
    const season = strataPhase.mul(0.11).add(0.5)
    const ice = palette(season, [{
      at: 0,
      rgb: hsl.integer(213, 100, 97),
    }, {
      at: 0.22,
      rgb: hsl.integer(226, 74, 79),
    }, {
      at: 0.48,
      rgb: hsl.integer(253, 86, 46),
    }, {
      at: 0.72,
      rgb: hsl.integer(255, 73, 23),
    }, {
      at: 0.9,
      rgb: hsl.integer(251, 45, 8),
    }, {
      at: 1,
      rgb: hsl.integer(218, 100, 94.7),
    }])
    const milk = ridgedNoise(p.mul(3.1).add(vec3(4, 0, 1))).smoothstep(0.42, 0.78)
    const body = mix(ice, color(hsl.integer(232, 100, 98)), milk.mul(0.22))
    const steps = 5
    let inclusion: Node<'vec3'> = vec3(0)
    let bubbleMask: Node<'float'> = float(0)
    for (let index = 0;index < steps;index++) {
      const depth = 0.016 + index * 0.02
      const q = p.sub(view.mul(depth))
      const bubbleField = mx_noise_float(q.mul(18 + index * 3).add(index * 9.1))
      const gate = bubbleField.smoothstep(0.72, 0.84)
      const cell = q.mul(18).fract().sub(0.5)
      const dist = cell.length()
      const footprint = dist.fwidth().max(0.002)
      const radius = bubbleField.mul(0.05).add(0.07)
      const disc = dist.smoothstep(radius.add(footprint), radius.mul(0.35)).clamp().mul(gate)
      const shell = dist.smoothstep(radius.mul(0.95), radius.mul(0.55)).mul(dist.smoothstep(radius.mul(0.2), radius.mul(0.55)))
      const fade = 1 - index * 0.14
      bubbleMask = bubbleMask.max(disc.mul(intimate).mul(fade))
      inclusion = inclusion.add(color(hsl.integer(220, 100, 99)).mul(shell).mul(gate).mul(intimate).mul(fade * 0.7))
    }
    const crackField = fractalNoise(p.mul(4.6).add(view.mul(0.7)), 4, 2.2, 0.48).sub(0.18)
    const crack = screenRibbon(crackField, 0.035).mul(grazing.mul(0.4).add(0.7))
    const silt = mx_noise_float(p.mul(30)).mul(0.5).add(0.5)
    const band = strata.abs().smoothstep(0.55, 0.92)
    const height = strata.mul(0.004).add(milk.mul(0.003))
    this.positionNode = positionGeometry.add(normalLocal.mul(height.mul(0.3)))
    this.colorNode = mix(body, color(hsl.integer(220, 100, 99)), bubbleMask.mul(0.7)).mul(silt.mul(0.06).add(0.96))
    this.roughnessNode = float(0.035).add(milk.mul(0.08)).add(silt.mul(intimate).mul(0.04)).clamp(0.015, 0.16)
    this.metalness = 0
    this.ior = 1.31
    this.transmissionNode = float(0.82).sub(milk.mul(0.22)).sub(bubbleMask.mul(0.25)).clamp(0.42, 0.9)
    this.thicknessNode = float(0.28).add(facing.mul(0.18)).add(band.mul(0.08))
    this.attenuationColorNode = mix(color(hsl.integer(222, 100, 90)), color(hsl.integer(252, 70, 17)), band.mul(0.55).add(0.15))
    this.attenuationDistanceNode = float(0.42).add(near.mul(0.28))
    this.dispersionNode = float(0.35).add(grazing.mul(0.45)).add(band.mul(0.2))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.02).add(crack.mul(0.05))
    this.iridescenceNode = crack.mul(0.95).add(grazing.pow(2.4).mul(0.4))
    this.iridescenceIOR = 1.2
    this.iridescenceThicknessNode = strataPhase.abs().mul(70).add(140).add(distance.mul(18))
    const carved = proceduralNormal(height.add(crackField.mul(0.006)).add(band.mul(0.004)), 1.35)
    this.normalNode = carved
    this.clearcoatNormalNode = proceduralNormal(strata.mul(0.003), 0.55)
    const caustic = band.pow(2)
    const melt = time.mul(0.17).add(strataPhase.mul(0.25)).sin().mul(0.5).add(0.5)
    this.emissiveNode = color(hsl.integer(226, 100, 84)).mul(caustic).mul(facing).mul(0.16).add(color(hsl.integer(232, 100, 98)).mul(crack).mul(grazing.pow(1.2)).mul(0.55)).add(inclusion.mul(1.4)).add(color(hsl.integer(224, 100, 95)).mul(melt).mul(caustic).mul(near).mul(0.1))
  }
}
