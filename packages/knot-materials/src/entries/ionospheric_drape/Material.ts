import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, mx_noise_float, time, uv} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** polar night glass; aurora curtains hang inside, hue follows your orbit */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.8
    this.transmission = 0.88
    this.thickness = 0.55
    this.ior = 1.32
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(245, 74, 19))
    this.attenuationDistance = 0.45
    this.roughness = 0.04
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const shallow = p.sub(view.mul(0.1))
    const deep = p.sub(view.mul(0.26))
    const curtain = (q: Node<'vec3'>, freq: number, speed: number) => {
      const warp = mx_fractal_noise_float(q.mul(2.4), 3, 2, 0.5).mul(2.2)
      return q.y.mul(freq).add(warp).add(time.mul(speed)).sin().mul(0.5).add(0.5).pow(2)
    }
    const bandA = curtain(shallow, 9, 0.1)
    const bandB = curtain(deep, 6, -0.07)
    const rays = opticalBands(tube.x.mul(140).add(mx_noise_float(p.mul(4)).mul(6))).mul(intimate.mul(0.7).add(0.3))
    const hue = bandA.mul(1.2).add(view.x.mul(1.5)).add(view.y).add(time.mul(0.05))
    const aurora = cosinePalette(hue, [0.12, 0.5, 0.4], [0.3, 0.32, 0.38], [1, 1, 1], [0.55, 0, 0.3])
    this.colorNode = color(hsl.integer(252, 63, 6))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(3).add(time.mul(0.05))), 0.0018)
    this.emissiveNode = aurora.mul(bandA.mul(0.9).add(bandB.mul(0.6))).mul(rays.mul(0.6).add(0.55)).mul(near.mul(0.7).add(0.45))
      .add(color(hsl.integer(168, 85, 84.6)).mul(rim).mul(0.22))
      .add(color(hsl.integer(302, 100, 65)).mul(grazing.pow(3)).mul(0.15))
  }
}
