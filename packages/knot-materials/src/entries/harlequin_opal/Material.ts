import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** precious opal; fire patches glide with parallax and ignite as the viewing angle aligns */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.7
    this.transmission = 0.25
    this.thickness = 0.5
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(344, 100, 95))
    this.attenuationDistance = 0.9
    this.roughness = 0.22
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(0, 0, 100))
    this.sheenRoughness = 0.45
    const {p, view, rim, near, intimate} = viewerFrame()
    const cellP = p.sub(view.mul(0.12)).mul(4.2)
    // Jitter 0.2 separates sites by at least 0.8: capped support dies before their ID boundary.
    const feature = mx_worley_noise_float(cellP, 0.2, 1)
    const id = cellNoiseVec3(vec3(feature.mul(65_536), 7, 19))
    const id2 = cellNoiseVec3(vec3(feature.mul(65_536), 31, 43))
    const d = mx_worley_noise_float(cellP, 0.2, 0)
    const footprint = cellP.fwidth().length().max(0.001)
    const patch = d.smoothstep(0.08, footprint.mul(1.5).add(0.34).min(0.39)).oneMinus()
    const present = id2.x.smoothstep(0.42, 0.55)
    const ignition = view.x.mul(2.6).add(view.y.mul(1.9)).add(id.z.mul(6.283)).cos().mul(0.5).add(0.5).pow(3)
    const playColor = spectralColor(id.y.mul(6).add(view.x.mul(2)).add(view.y.mul(1.2)))
    const flash = patch.mul(present).mul(ignition)
    const pin = cellularPoints(p.sub(view.mul(0.06)).mul(70), 0.025, 0.16, 0.65).mul(intimate)
    this.colorNode = mix(color(hsl.integer(81, 27, 92.5)), color(hsl.integer(78, 23, 86)), mx_noise_float(p.mul(5)).mul(0.5).add(0.5))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(8)), 0.0006)
    this.emissiveNode = playColor.mul(flash).mul(1.7).mul(near.mul(0.5).add(0.6))
      .add(spectralColor(mx_noise_float(p.mul(7)).mul(9).add(2)).mul(pin).mul(1.6))
      .add(color(hsl.integer(346, 100, 91)).mul(rim).mul(0.12))
  }
}
