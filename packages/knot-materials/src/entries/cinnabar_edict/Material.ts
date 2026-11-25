import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const q = p.mul(5.4)
    const cell = cellNoiseVec3(q)
    const cell2 = cellNoiseVec3(q.add(vec3(19.7, 4.3, 28.1)))
    const local = q.fract().sub(0.5)
    const stamp = local.length().smoothstep(0.46, 0.32)
    const carved = opticalLine(local.x.mul(cell.x.mul(14).add(4)).add(local.y.mul(cell.y.mul(11).add(3))).add(cell2.z.mul(2)).sin(), 0.05)
    const stroke = opticalLine(local.y.mul(cell2.x.mul(9).add(2.5)).sub(local.x.mul(cell2.y.mul(7).add(2))).cos(), 0.04)
    const frame = opticalLine(local.x.abs().max(local.y.abs()).sub(0.31), 0.03)
    const seal = stamp.mul(carved.max(stroke).max(frame))
    const script = opticalLine(tube.x.mul(36).add(tube.y.mul(8)).add(mx_noise_float(p.mul(3)).mul(2)).fract().sub(0.5), 0.03).mul(intimate)
    const inlay = seal.max(script)
    const lacquerNoise = mx_noise_float(p.mul(3.2)).mul(0.08)
    const lacquer = mix(color(hsl.integer(13, 73, 4.7)), color(hsl.integer(29, 97, 35)), grazing.pow(1.7).mul(0.75).add(lacquerNoise).clamp())
    const vermillion = mix(color(hsl.integer(29, 97, 23.5)), color(hsl.integer(31, 94.5, 54)), facing.mul(0.4).add(0.35))
    const gold = mix(color(hsl.integer(70, 81, 43)), color(hsl.integer(87, 100, 91)), glints(normalViewGeometry, 64).add(grazing.mul(0.3)))
    this.colorNode = mix(mix(lacquer, vermillion, stamp.mul(0.55).add(0.2)), gold, inlay)
    this.metalnessNode = inlay.mul(0.92)
    this.roughnessNode = float(0.38).mix(0.16, inlay)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.normalNode = proceduralNormal(inlay.mul(0.55).add(mx_noise_float(p.mul(16)).mul(0.12)), 0.0018)
    this.emissiveNode = gold
      .mul(inlay)
      .mul(glints(normalViewGeometry, 50))
      .mul(0.85)
      .mul(near.mul(0.55).add(0.4))
      .add(color(hsl.integer(35, 99, 63)).mul(stamp.oneMinus()).mul(grazing).mul(0.04))
      .add(color(hsl.integer(27, 93, 12)).mul(rim).mul(0.14))
      .add(color(hsl.integer(83, 100, 86.6)).mul(script).mul(intimate).mul(0.35))
  }
}
