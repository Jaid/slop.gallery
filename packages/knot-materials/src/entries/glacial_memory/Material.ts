import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionViewDirection, vec3} from 'three/tsl'

import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumIntimate} from '../../candidates/gpt_astra/lib/premiumIntimate.ts'
import {premiumLine} from '../../candidates/gpt_astra/lib/premiumLine.ts'
import {premiumView} from '../../candidates/gpt_astra/lib/premiumView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export /** A signed, warped network of intersecting mineral fracture planes. */
function glacierField(q: Node<'vec3'>) {
  const warp = mx_noise_vec3(q.mul(4.3)).mul(0.045)
  const s = q.add(warp)
  const a = s.dot(vec3(17, 9, -5)).add(0.4).sin().abs()
  const b = s.dot(vec3(-8, 21, 13)).add(1.7).sin().abs()
  const c = s.dot(vec3(11, -7, 24)).sub(0.8).sin().abs()
  return a.min(b).min(c)
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const view = premiumView()
    const detail = premiumDetail()
    const intimate = premiumIntimate()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const frontField = glacierField(p)
    const middleField = glacierField(p.sub(view.mul(0.12)))
    const deepField = glacierField(p.sub(view.mul(0.29)))
    const surfaceCracks = premiumLine(frontField, 0.026)
    const middleCracks = premiumLine(middleField, 0.018)
    const deepCracks = premiumLine(deepField, 0.013)
    const weather = mx_noise_float(p.mul(6.5)).mul(0.5).add(0.5)
    const frost = weather.smoothstep(0.59, 0.77)
    const crystalGrain = mx_noise_float(p.mul(95)).mul(0.5).add(0.5)
    const fractureFlash = view.dot(vec3(-0.36, 0.81, 0.46).normalize()).abs().pow(22)
    const fractureFlash2 = view.dot(vec3(0.84, 0.18, -0.51).normalize()).abs().pow(28)
    const ice = mix(color(hsl.integer(216, 48, 85)), color(hsl.integer(223, 100, 97.3)), weather.mul(0.4).add(0.4))
    const cloudyIce = mix(ice, color(hsl.integer(185, 27, 97)), frost.mul(0.88))
    this.colorNode = mix(cloudyIce, color(hsl.integer(230, 49, 50)), middleCracks.mul(detail).mul(0.16))
    this.transmission = 0.9
    this.transmissionNode = frost.mul(0.5).oneMinus().mul(0.92)
    this.thickness = 0.62
    this.ior = 1.31
    this.dispersion = 0.045
    this.attenuationColor.set(hsl.integer(217, 48, 82))
    this.attenuationDistance = 1.4
    this.roughnessNode = frost.mul(0.32).add(surfaceCracks.mul(0.065)).add(0.048)
    this.clearcoat = 0.65
    this.clearcoatRoughnessNode = frost.mul(0.16).add(0.035)
    const relief = surfaceCracks.mul(-0.5).add(crystalGrain.mul(frost).mul(intimate).mul(0.17))
    this.normalNode = premiumNormal(relief.mul(detail), 0.00065)
    this.clearcoatNormalNode = premiumNormal(mx_noise_float(p.mul(11)), 0.00012)
    this.emissiveNode = color(hsl.integer(210, 100, 95)).mul(surfaceCracks).mul(fractureFlash.mul(0.8).add(0.07)).add(color(hsl.integer(228, 54, 77)).mul(middleCracks).mul(detail).mul(fractureFlash2.mul(0.5).add(0.13))).add(color(hsl.integer(230, 60, 54)).mul(deepCracks).mul(intimate).mul(0.19)).add(color(hsl.integer(227, 100, 92)).mul(grazing.pow(6)).mul(frost).mul(0.08))
    this.envMapIntensity = 0.95
  }
}
