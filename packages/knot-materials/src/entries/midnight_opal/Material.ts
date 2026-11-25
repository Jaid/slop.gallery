import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time} from 'three/tsl'

import {bell} from '../../candidates/glm_flash/lib/bell.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, near, intimate} = viewerFrame()
    const q = p.mul(10)
    const cell = cellNoiseVec3(q)
    const centre = cell.mul(0.4).add(0.3)
    const dist = q.fract().sub(centre).length()
    const foot = q.fwidth().length().max(0.001)
    const mask = dist.smoothstep(0.3, foot.add(0.32)).oneMinus()
    const gate = bell(facing.sub(cell.z.mul(0.55).add(0.15)), 0, 26)
    const hue = cell.x.mul(6.283).add(facing.mul(2.6)).add(time.mul(0.06))
    const patchColor = spectralColor(hue).mul(0.7).add(0.3)
    const potch = mx_noise_float(p.mul(3.2)).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(274, 32, 4)), color(hsl.integer(253, 42, 11)), potch.mul(0.65).add(mx_noise_float(p.mul(12)).mul(0.2).add(0.2)).clamp())
    this.metalness = 0
    this.roughness = 0.06
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.ior = 1.45
    this.iridescence = 0.35
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = facing.mul(420).add(180)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(6)), 0.0008)
    const sq = p.mul(64)
    const sr = cellNoiseVec3(sq)
    const sd = sq.fract().sub(sr.mul(0.4).add(0.3)).length()
    const sf = sq.fwidth().length().max(0.001)
    const spark = sd.smoothstep(0.02, sf.add(0.03)).oneMinus().mul(sr.z.smoothstep(0.8, 0.84))
    const sparkTwinkle = time.mul(sr.y.mul(5).add(2)).add(sr.x.mul(25)).sin().mul(0.4).add(0.6)
    this.emissiveNode = patchColor.mul(mask).mul(gate).mul(near.mul(0.65).add(0.5)).mul(2.4)
      .add(spectralColor(cell.x.mul(6.283)).mul(mask).mul(near.oneMinus()).mul(0.3))
      .add(color(hsl.integer(0, 0, 100)).mul(spark).mul(sparkTwinkle).mul(facing.mul(facing)).mul(intimate).mul(1.2))
  }
}
