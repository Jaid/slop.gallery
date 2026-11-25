import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const rayNoise = mx_noise_float(vec3(tube.y.mul(3.2), tube.x.mul(2.1), time.mul(0.06)))
    const rayPhase = rayNoise.mul(2.6).add(tube.y.mul(56)).add(time.mul(0.05))
    const rays = opticalLine(rayPhase.sin(), 0.045)
    const curtain = mx_noise_float(vec3(tube.x.mul(1.4).sub(time.mul(0.045)), 8.8, tube.y.mul(0.6))).smoothstep(-0.2, 0.75)
    const shimmer = mx_noise_float(vec3(tube.x.mul(5).add(time.mul(0.35)), tube.y.mul(2.5), 2.2)).mul(0.45).add(0.7)
    const alt = tube.y.add(mx_noise_float(vec3(tube.x.mul(2), 4.4, time.mul(0.03))).mul(0.18))
    const auroraCol = mix(mix(color(hsl.integer(155, 100, 85.94)), color(hsl.integer(242, 99, 69)), alt.smoothstep(0.3, 0.7)), color(hsl.integer(313, 100, 60.6)), alt.smoothstep(0.68, 0.98))
    const deepGlow = mx_noise_float(p.mul(1.1).add(vec3(time.mul(0.02), 0, 0))).smoothstep(-0.1, 0.95).mul(0.5)
    this.colorNode = color(hsl.integer(204, 51, 5))
    this.transmission = 0.82
    this.thickness = 0.55
    this.ior = 1.35
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(173, 87, 23))
    this.attenuationDistance = 0.9
    this.roughness = 0.035
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(4.5).add(vec3(0, time.mul(0.05), 0))), 0.0012)
    this.emissiveNode = auroraCol.mul(rays).mul(curtain).mul(shimmer)
      .mul(grazing.pow(1.25).mul(1.15).add(0.35))
      .mul(near.mul(0.45).add(0.65))
      .mul(1.7)
      .add(color(hsl.integer(163, 95, 33)).mul(deepGlow).mul(0.3))
      .add(color(hsl.integer(169.7, 100, 87.15)).mul(intimate).mul(rays).mul(0.35))
  }
}
