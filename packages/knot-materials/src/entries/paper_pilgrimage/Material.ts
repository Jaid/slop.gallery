import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {inkLine} from '../../lib/atelier.ts'
import {proceduralNormal, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = data.id
    const {p, near, view, grazing} = viewerFrame()
    const warp = mx_noise_float(p.mul(3.1))
    const elevation = mx_noise_float(p.mul(5.2).add(vec3(warp.mul(0.7), 0, warp.mul(0.4)))).mul(0.7).add(p.y.mul(0.6)).add(0.4)
    const phase = elevation.mul(15)
    const aa = phase.fwidth().max(0.001)
    const page = phase.fract()
    const edge = inkLine(page.sub(0.5), 0.055, aa)
    const lip = inkLine(page.sub(0.39), 0.025, aa)
    const terrace = page.smoothstep(0.36, 0.52)
    const relief = phase.floor().add(terrace).div(15)
    const depth = elevation.smoothstep(-0.05, 0.95)
    const coral = mix(color(hsl.integer(30, 71, 47)), color(hsl.integer(48, 78, 81)), depth)
    const cream = mix(color(hsl.integer(84, 28, 81)), color(hsl.integer(86, 100, 95.5)), depth)
    const pageColor = phase.floor().mul(1.7).sin().smoothstep(-0.4, 0.5)
    let paper = mix(coral, cream, pageColor)
    const pools = elevation.smoothstep(-0.14, 0.08).oneMinus()
    paper = mix(paper, color(hsl.integer(13, 63, 40)), pools.mul(0.6))
    paper = mix(paper, color(hsl.integer(9, 59, 23)), edge.mul(0.85))
    paper = mix(paper, color(hsl.integer(88, 100, 97)), lip.mul(0.55))
    const fibers = mx_noise_float(p.mul(vec3(320, 100, 160))).mul(0.5).add(0.5)
    this.colorNode = paper.mul(fibers.mul(near).mul(0.055).add(0.96))
    this.roughnessNode = float(0.86).sub(lip.mul(0.1))
    this.metalness = 0
    this.sheen = 0.12
    this.sheenColor.set(hsl.integer(74, 100, 96))
    this.sheenRoughness = 0.85
    this.normalNode = proceduralNormal(relief.mul(0.035).add(fibers.mul(near).mul(0.00008)), 1)
    this.aoNode = edge.mul(-0.65).add(1)
    // Light breathes beneath the cut edges; the pages themselves remain physically still.
    const breath = time.mul(0.45).add(elevation.mul(9)).add(view.x.mul(2)).sin().mul(0.5).add(0.5)
    this.emissiveNode = color(hsl.integer(39, 83, 73)).mul(lip).mul(breath).mul(grazing.mul(0.7).add(0.3)).mul(0.18)
  }
}
