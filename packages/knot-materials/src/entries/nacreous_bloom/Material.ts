import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.2
    const {p, view, facing, rim, near} = viewerFrame()
    const drift = vec3(time.mul(0.01), time.mul(-0.008), time.mul(0.012))
    const swirl = mx_fractal_noise_float(p.mul(4).add(drift), 3, 2, 0.55)
    const ridge = opticalLine(swirl.mul(18).sin(), 0.04)
    const film = p.dot(view).mul(2).add(swirl.mul(3))
    const nacre = cosinePalette(film, [0.55, 0.5, 0.6], [0.35, 0.4, 0.35], [1, 1, 1], [0, 0.2, 0.4])
    const pearl = mix(color(hsl.integer(314, 100, 94)), nacre, facing.mul(0.7).add(0.3))
    this.colorNode = pearl
    this.metalness = 0.1
    this.roughnessNode = ridge.mul(0.12).add(0.06)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 1
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = film.mul(180).add(240)
    this.normalNode = liquidNormal(near, 0.08)
    this.emissiveNode = nacre.mul(ridge).mul(near.mul(0.4).add(0.2)).add(color(hsl.integer(339, 100, 84)).mul(rim).mul(0.2)).add(color(hsl.integer(0, 0, 100)).mul(facing.pow(8)).mul(0.15))
  }
}
