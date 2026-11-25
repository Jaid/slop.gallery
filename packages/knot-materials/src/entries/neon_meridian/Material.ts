import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, uv, vec3, vec4} from 'three/tsl'

import {hash1} from '../../candidates/glm/lib/hash1.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const grazing = normalViewGeometry.dot(positionViewDirection).abs().clamp().oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const strand = uv()
    const lanes = 5
    const lane = strand.y.mul(lanes)
    const laneIndex = lane.floor().mul(1 / lanes).fract().mul(lanes)
    const laneOffset = lane.fract().sub(0.5)
    const traces = opticalLine(laneOffset, 0.05)
    const laneRand = hash1(vec3(laneIndex, 2.7, 5.5)).mul(0.5).add(0.5)
    const speed = laneRand.mul(7).add(2)
    const signal = strand.x.mul(6.2831853 * 5).sub(time.mul(speed)).sin().mul(0.5).add(0.5).pow(11)
    const packet = opticalLine(strand.x.mul(6.2831853).sub(time.mul(1.25)).sin(), 0.09)
    const block = strand.x.mul(110).floor().mul(1 / 110).fract().mul(110)
    const rungs = opticalLine(strand.x.mul(110).fract().sub(0.5), 0.08).mul(hash1(vec3(block, 4.4, 8.8)).smoothstep(0.35, 0.55))
    const chips = hash1(vec3(strand.x.mul(13).floor(), strand.y.mul(3).floor(), 21.7)).smoothstep(0.45, 0.62)
    const etch = laneOffset.abs().smoothstep(0.16, 0.5)
    const hue = laneIndex.mul(0.42).add(view.x.mul(0.5)).add(view.y.mul(0.25)).add(0.1)
    const traceColor = spectralColor(hue)
    const power = mx_noise_float(vec3(time.mul(2.2), 3.1, 7.7)).mul(0.12).add(0.94)
    this.colorNode = color(hsl.integer(258, 22, 7))
    this.metalness = 0.88
    this.roughnessNode = etch.mul(0.34).add(0.13)
    this.clearcoat = 0.55
    this.clearcoatRoughness = 0.06
    this.envMapIntensity = 1.2
    this.normalNode = proceduralNormal(etch.oneMinus(), 0.0013)
    this.emissiveNode = traceColor.mul(traces).mul(signal.mul(1.1).add(0.22)).mul(near.mul(0.75).add(0.35))
      .add(color(hsl.integer(0, 0, 100)).mul(packet).mul(traces).mul(2.4))
      .add(color(hsl.integer(340, 100, 72.4)).mul(rungs).mul(near).mul(0.9))
      .add(color(hsl.integer(336, 100, 79)).mul(chips).mul(0.5))
      .add(traceColor.mul(rim).mul(0.3))
      .mul(power)
  }
}
