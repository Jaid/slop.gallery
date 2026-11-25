import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, rim, near} = viewerFrame()
    const pulse = time.mul(1.1).add(mx_noise_float(p.mul(1.8)).mul(2)).sin().mul(0.5).add(0.5)
    const veins = opticalLine(mx_worley_noise_float(p.mul(3.5).add(vec3(0, time.mul(0.12), 0))).sub(0.3), 0.012)
    const dots = cellularPoints(p.mul(28), 0.06, 0.24, 0.93).mul(pulse)
    const glowColor = mix(color(hsl.integer(171, 100, 87)), color(hsl.integer(3, 100, 58.7)), mx_noise_float(p.mul(1.2)).mul(0.5).add(0.5))
    this.colorNode = color(hsl.integer(247, 63, 8))
    this.transmission = 0.88
    this.thickness = 1.4
    this.ior = 1.34
    this.attenuationColor.set(hsl.integer(219, 100, 36))
    this.attenuationDistance = 0.7
    this.roughness = 0.18
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.normalNode = liquidNormal(near, 0.28)
    this.emissiveNode = glowColor.mul(veins.mul(1.4).add(dots.mul(2.2))).mul(near.mul(0.9).add(0.35)).add(color(hsl.integer(195, 100, 90.6)).mul(rim).mul(0.45))
  }
}
