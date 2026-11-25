import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.85
    const {p, near, intimate} = viewerFrame()
    const far = near.oneMinus()
    const tube = uv()
    const warpCount = 44
    const wu = tube.x.mul(warpCount)
    const weaveU = wu.fract().sub(0.5)
    const weaveV = tube.y.mul(140).fract().sub(0.5)
    const threadId = wu.floor()
    const rnd = cellNoiseVec3(vec3(threadId.add(0.5), 5.5, 9.9))
    const warpLine = opticalLine(weaveU, 0.055)
    const weftLine = opticalLine(weaveV, 0.02).mul(0.4).mul(intimate.mul(0.7).add(0.3))
    const weaveH = weaveU.mul(Math.PI * 2).cos().mul(0.6).add(weaveV.mul(Math.PI * 2).cos().mul(0.5))
    const dir = rnd.y.sub(0.5).sign()
    const speed = rnd.x.mul(0.16).add(0.04)
    const s = tube.x.sub(time.mul(speed).mul(dir)).add(rnd.z).fract()
    const tailA = s.smoothstep(0.84, 1)
    const tailB = s.smoothstep(0, 0.16).oneMinus()
    const comet = mix(tailA, tailB, dir.mul(0.5).add(0.5))
    const headA = s.smoothstep(0, 0.012).oneMinus()
    const headB = s.oneMinus().smoothstep(0, 0.012).oneMinus()
    const headGlint = headA.min(headB)
    const activity = rnd.z.smoothstep(0.25, 0.3)
    const pulseCol = spectralColor(rnd.x.mul(6.283).add(time.mul(0.12)))
    const base = mix(color(hsl.integer(290, 26, 6)), color(hsl.integer(294, 31, 9)), mx_noise_float(p.mul(6)).mul(0.5).add(0.5))
    this.colorNode = mix(mix(base, base.add(pulseCol.mul(0.06)), warpLine), color(hsl.integer(293, 27, 4.4)), weftLine.mul(0.6))
    this.metalness = 0.25
    this.roughnessNode = float(0.42).mix(0.3, warpLine)
    this.anisotropy = 0.65
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(278, 100, 65))
    this.sheenRoughness = 0.42
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.3
    this.normalNode = proceduralNormal(weaveH, 0.002)
    this.emissiveNode = pulseCol.mul(comet).mul(warpLine).mul(activity).mul(near.mul(0.5).add(0.6)).mul(2.4)
      .add(color(hsl.integer(0, 0, 100)).mul(headGlint).mul(warpLine).mul(activity).mul(1.4))
      .add(pulseCol.mul(warpLine).mul(0.05))
      .add(pulseCol.mul(warpLine).mul(far).mul(0.12))
  }
}
