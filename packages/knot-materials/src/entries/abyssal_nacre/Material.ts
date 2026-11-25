import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, uv} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.045))
    const stack = mx_noise_float(inner.mul(6.2)).add(mx_fractal_noise_float(inner.mul(2.4), 3, 2.1, 0.48).mul(0.45))
    const platelets = mx_noise_float(inner.mul(36)).mul(0.5).add(0.5)
    const terrace = opticalBands(stack.mul(38).add(platelets.mul(8)))
    const path = inner
      .dot(view)
      .mul(3.8)
      .add(stack.mul(4.2))
      .add(view.x.mul(1.8))
      .add(view.y.mul(1.2))
      .add(facing.mul(2.4))
    const play = cosinePalette(path, [0.42, 0.46, 0.4], [0.55, 0.48, 0.5], [1, 0.82, 1.18], [0, 0.33, 0.67])
    const abalone = mix(color(hsl.integer(175, 38, 7)), play, facing.mul(0.45).add(grazing.mul(0.7)).clamp())
    const tile = uv()
    const growth = opticalLine(tile.x.mul(28).add(stack.mul(2)).fract().sub(0.5), 0.06).mul(intimate)
    const sparkle = glints(normalViewGeometry.add(mx_noise_vec3(inner.mul(22)).mul(0.2)).normalize(), 70)
    this.colorNode = mix(abalone, play.mul(1.15), terrace.mul(0.28).add(growth.mul(0.35)))
    this.metalness = 0.18
    this.roughnessNode = terrace.mul(0.08).add(grazing.mul(0.12)).add(0.08)
    this.iridescence = 1
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = stack.mul(140).add(facing.mul(220)).add(280)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.sheen = 0.55
    this.sheenColor.set(hsl.integer(176, 60, 85.4))
    this.sheenRoughness = 0.35
    this.normalNode = proceduralNormal(stack.mul(0.35).add(platelets.mul(0.12)), 0.0018)
    this.emissiveNode = play
      .mul(grazing.pow(1.4).mul(0.55).add(terrace.mul(0.4)))
      .mul(near.mul(0.55).add(0.35))
      .add(play.mul(sparkle).mul(intimate).mul(0.9))
      .add(color(hsl.integer(180, 90, 19)).mul(rim).mul(0.16))
  }
}
