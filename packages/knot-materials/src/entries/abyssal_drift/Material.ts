import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** hadal creature; light organs pulse along the body, alarm-quickening when you come close */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.7
    this.transmission = 0.85
    this.thickness = 0.5
    this.ior = 1.28
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(258, 87, 9))
    this.attenuationDistance = 0.35
    this.roughness = 0.06
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    const {p, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const rate = intimate.mul(2.2).add(0.9)
    const wave = tube.x.mul(Math.PI * 6).sub(time.mul(rate)).sin().mul(0.5).add(0.5).pow(6)
    const rings = opticalLine(tube.y.mul(18).fract().sub(0.5), 0.06)
    const cells = cellNoiseVec3(vec3(tube.x.mul(90).floor(), tube.y.mul(18).floor(), 2.7))
    const organs = rings.mul(cells.x.smoothstep(0.55, 0.7))
    const shimmer = mx_noise_float(p.mul(24).add(vec3(0, time.mul(0.5), 0))).mul(0.5).add(0.5)
    const bio = mix(color(hsl.integer(261.3, 100, 51)), color(hsl.integer(203, 100, 86.6)), wave)
    const alarm = mix(bio, color(hsl.integer(294, 100, 59)), intimate.mul(0.5))
    this.colorNode = color(hsl.integer(255, 69, 5.5))
    this.normalNode = liquidNormal(near, 0.1)
    this.emissiveNode = alarm.mul(organs.mul(0.85).add(wave.mul(0.3))).mul(near.mul(0.75).add(0.35))
      .add(color(hsl.integer(288, 100, 51)).mul(rim).mul(0.25))
      .add(color(hsl.integer(203, 100, 91)).mul(shimmer.pow(8)).mul(intimate).mul(0.8))
  }
}
