import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, time, vec2, vec3} from 'three/tsl'

import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumIntimate} from '../../candidates/gpt_astra/lib/premiumIntimate.ts'
import {premiumLine} from '../../candidates/gpt_astra/lib/premiumLine.ts'
import {premiumView} from '../../candidates/gpt_astra/lib/premiumView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export /** Repeating arched architecture, evaluated at arbitrary interior positions. */
function cathedralTracery(q: Node<'vec3'>) {
  const x = q.x.mul(9).fract().sub(0.5)
  const y = q.y.mul(7).fract()
  const upper = y.smoothstep(0.43, 0.48)
  const archDistance = vec2(x, y.sub(0.46)).length().sub(0.37)
  const arch = premiumLine(archDistance, 0.014).mul(upper)
  const jambs = premiumLine(x.abs().sub(0.37), 0.012).mul(upper.oneMinus()).mul(y.smoothstep(0.08, 0.13))
  const sill = premiumLine(y.sub(0.11), 0.013).mul(x.abs().smoothstep(0.37, 0.42).oneMinus())
  const mullion = premiumLine(x, 0.009).mul(y.smoothstep(0.1, 0.16)).mul(y.smoothstep(0.72, 0.83).oneMinus())
  const roseWindow = premiumLine(vec2(x, y.sub(0.63)).length().sub(0.085), 0.01)
  const crossbar = premiumLine(y.sub(0.46), 0.009).mul(x.abs().smoothstep(0.34, 0.39).oneMinus())
  return arch.add(jambs).add(sill).add(mullion.mul(0.65)).add(roseWindow).add(crossbar.mul(0.6)).clamp()
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
    const q0 = p.sub(view.mul(0.065))
    const q1 = p.sub(view.mul(0.16))
    const q2 = p.sub(view.mul(0.28))
    const q3 = p.sub(view.mul(0.41))
    const front = cathedralTracery(q0)
    const middle = cathedralTracery(q1.add(vec3(0.027, 0.014, 0)))
    const back = cathedralTracery(q2.add(vec3(0.054, 0.028, 0)))
    const sanctuary = cathedralTracery(q3.add(vec3(0.081, 0.042, 0)))
    // Perpendicular galleries give the illusion depth from multiple sides.
    const transept = cathedralTracery(vec3(q2.z, q2.y, q2.x).add(vec3(0.021, 0.065, 0)))
    const occlusion1 = front.mul(0.6).oneMinus()
    const occlusion2 = middle.mul(0.5).oneMinus()
    const lanternField = vec2(q3.x.mul(9).fract().sub(0.5), q3.y.mul(7).fract().sub(0.63)).length()
    const lanterns = lanternField.smoothstep(0.026, 0.105).oneMinus().mul(intimate.mul(0.65).add(0.35))
    const waterLight = q2.y.mul(15).add(q2.x.mul(11)).add(time.mul(0.22)).sin().mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(240, 58, 17)), color(hsl.integer(232, 45, 39)), grazing.abs().pow(2).mul(0.45))
    this.transmission = 0.68
    this.thickness = 0.48
    this.ior = 1.57
    this.dispersion = 0.08
    this.attenuationColor.set(hsl.integer(221, 47, 50))
    this.attenuationDistance = 1.1
    this.roughness = 0.045
    this.clearcoat = 1
    this.clearcoatRoughness = 0.026
    this.normalNode = premiumNormal(mx_noise_float(p.mul(7)), 0.00014)
    const architecture = color(hsl.integer(205, 53, 87)).mul(front).mul(0.33).add(color(hsl.integer(213, 55, 73.5)).mul(middle).mul(occlusion1).mul(detail.mul(0.45).add(0.24))).add(color(hsl.integer(228, 67, 53)).mul(back).mul(occlusion1).mul(occlusion2).mul(detail).mul(0.46)).add(color(hsl.integer(80, 58, 77)).mul(sanctuary).mul(intimate).mul(0.55)).add(color(hsl.integer(218, 67, 55)).mul(transept).mul(detail).mul(0.19))
    this.emissiveNode = architecture.mul(facing.mul(0.3).add(0.7)).mul(waterLight.mul(0.13).add(0.87)).add(color(hsl.integer(86, 100, 90.7)).mul(lanterns).mul(0.85))
    this.envMapIntensity = 0.8
  }
}
