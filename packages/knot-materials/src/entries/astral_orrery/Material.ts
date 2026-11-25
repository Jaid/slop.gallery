import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_cell_noise_float, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.1
    const {p, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const rings = opticalLine(tube.x.mul(48).fract().sub(0.5), 0.04)
    const fineRings = opticalLine(tube.x.mul(192).fract().sub(0.5), 0.03).mul(intimate)
    const gearTeeth = mx_cell_noise_float(vec3(tube.x.mul(180), tube.y.mul(8), 0)).smoothstep(0.6, 0.7)
    const lat = opticalLine(tube.y.mul(12).fract().sub(0.5), 0.05)
    const latFine = opticalLine(tube.y.mul(48).fract().sub(0.5), 0.04).mul(intimate)
    const engrave = rings.max(lat).add(fineRings.add(latFine).mul(0.6)).add(gearTeeth.mul(0.4)).clamp()
    // Stars need localized round cores; whole noise cells reveal cyan rectangular patches.
    const constellation = cellularPoints(p.mul(24).add(vec3(0, time.mul(0.01), 0)), 0.06, 0.24, 0.92)
    const patina = mx_noise_float(p.mul(3).add(time.mul(0.005))).mul(0.5).add(0.5)
    const brass = mix(color(hsl.integer(67, 73, 18)), color(hsl.integer(81, 73, 71)), patina.mul(0.6).add(0.3))
    this.colorNode = mix(brass, color(hsl.integer(92, 100, 92.7)), engrave.mul(0.7))
    this.metalness = 0.95
    this.roughnessNode = engrave.mul(-0.25).add(0.35)
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.15
    this.normalNode = proceduralNormal(engrave.mul(0.6).add(constellation.mul(0.3)), 0.0015)
    this.emissiveNode = color(hsl.integer(86, 100, 86)).mul(engrave).mul(0.25).add(color(hsl.integer(203, 99, 89.6)).mul(constellation).mul(near.mul(0.7).add(0.2)).mul(1.2)).add(color(hsl.integer(66, 100, 74)).mul(rim).mul(0.15))
  }
}
