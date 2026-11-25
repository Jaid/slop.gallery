import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {fbm} from '../../candidates/glm/lib/fbm.ts'
import {starGlints} from '../../candidates/glm/lib/starGlints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

function heartbeat(rate: number): Node<'float'> {
  const phase = time.mul(rate).fract()
  const spike = (at: number, sharpness: number) => phase.sub(at).abs().mul(sharpness).oneMinus().clamp().pow(3)
  return spike(0.06, 9).add(spike(0.32, 12).mul(0.6)).clamp()
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const grazing = normalViewGeometry.dot(positionViewDirection).abs().clamp().oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const pulse = heartbeat(0.82)
    const swell = pulse.mul(0.65).add(0.7)
    const crust = fbm(p.mul(3.1))
    const crackField = crust.sub(0.08)
    const cracks = opticalLine(crackField, 0.045)
    const cracksWide = opticalLine(crackField, 0.11)
    const inner = p.sub(view.mul(0.15))
    const deepField = fbm(inner.mul(4.4).add(vec3(0, time.mul(0.05), 0))).sub(0.15)
    const deepCracks = opticalLine(deepField, 0.05).mul(near)
    const embers = starGlints(p.mul(120), view, 20).mul(cracksWide)
    const heat = pulse.mul(0.6).add(0.4).mul(near.mul(0.9).add(0.55))
    this.colorNode = mix(color(hsl.integer(76, 28, 8)), color(hsl.integer(50, 31, 17)), crust.mul(0.5).add(0.5)).add(color(hsl.integer(34, 78, 16)).mul(cracksWide))
    this.transmission = 0.42
    this.thickness = 0.55
    this.ior = 1.5
    this.dispersion = 0.12
    this.attenuationColor.set(hsl.integer(40, 87, 11))
    this.attenuationDistance = 0.5
    this.roughnessNode = cracks.mul(-0.3).add(0.52).max(0.18)
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.22
    this.envMapIntensity = 0.85
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)).mul(swell).add(crust.mul(0.35)), 0.00042)
    this.emissiveNode = color(hsl.integer(30.6, 100, 45.5)).mul(cracksWide).mul(0.55)
      .add(color(hsl.integer(40, 100, 63.5)).mul(cracks).mul(1.25))
      .add(color(hsl.integer(78, 100, 89)).mul(deepCracks).mul(2.1))
      .mul(heat)
      .add(color(hsl.integer(68, 100, 82.6)).mul(embers).mul(heat).mul(0.9))
      .add(color(hsl.integer(46, 100, 68)).mul(rim).mul(pulse).mul(0.5))
  }
}
