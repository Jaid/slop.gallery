import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Woven light - black velvet that only reveals luminous warp/weft at grazing and up close */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, near} = viewerFrame()
    const tube = uv()
    const jitterA = mx_noise_float(p.mul(1.8)).mul(0.4)
    const jitterB = mx_noise_float(p.mul(1.8).add(vec3(5, 1, 3))).mul(0.4)
    const warpPhase = tube.x.mul(64).add(jitterA)
    const weftPhase = tube.y.mul(32).add(jitterB)
    const warpLine = opticalLine(warpPhase.fract().sub(0.5), 0.032)
    const weftLine = opticalLine(weftPhase.fract().sub(0.5), 0.038)
    const weave = warpLine.max(weftLine)
    const threadTint = spectralColor(tube.x.mul(8).add(time.mul(0.12)).add(tube.y.mul(2)))
    const threadTint2 = spectralColor(tube.x.mul(8).add(2.5).add(time.mul(0.12)))
    const velvet = color(hsl.integer(269, 15, 4.5))
    const reveal = weave.mul(near.mul(0.6).add(0.35)).mul(facing.oneMinus().pow(0.7).add(0.3))
    this.colorNode = mix(velvet, threadTint, reveal)
    this.roughnessNode = float(0.92).sub(weave.mul(0.55))
    this.metalnessNode = float(0)
    this.emissiveNode = threadTint.mul(warpLine).mul(near.mul(0.7).add(0.5)).mul(1.3)
      .add(threadTint2.mul(weftLine).mul(0.9))
      .add(color(hsl.integer(0, 0, 100)).mul(rim.pow(3).mul(weave).mul(0.18)))
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.6
    this.iridescence = 0.7
    this.iridescenceIOR = 1.8
    this.iridescenceThicknessNode = facing.mul(120).add(260).add(weave.mul(80))
    this.normalNode = proceduralNormal(weave.mul(0.5), 0.0008)
    this.envMapIntensity = 0.25
  }
}
