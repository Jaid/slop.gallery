import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.53)
    this.name = knotData.id
    const {p, grazing, near, view} = viewerFrame()
    const chart = uv()
    const warp = chart.x.mul(2 * Math.PI * 100)
    const weft = chart.y.mul(2 * Math.PI * 90)
    const interlace = chart.mul(vec2(100, 90)).floor().x.add(chart.mul(vec2(100, 90)).floor().y).mul(Math.PI).cos().mul(0.5).add(0.5)
    const strandU = opticalBands(warp).pow(2)
    const strandV = opticalBands(weft).pow(2)
    const thread = mix(strandU, strandV, interlace)
    const diamond = tile(chart, 10, 4).sub(vec2(0.5, 0.5))
    const edge = diamond.x.abs().mul(1.4).add(diamond.y.abs()).sub(0.47)
    const embroidery = stroke(edge, 0.027)
    const center = diamond.length().smoothstep(0.07, 0.16).oneMinus()
    const motif = embroidery.add(center.mul(0.36)).clamp()
    const broad = chart.x.mul(Math.PI * 20).add(chart.y.mul(Math.PI * 8)).sin().mul(0.5).add(0.5)
    const noise = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    const glimmer = time.mul(0.46).add(view.x.mul(4)).add(chart.x.mul(58)).sin().mul(0.5).add(0.5).pow(7)
    this.colorNode = mix(mix(color(hsl.integer(254, 71, 14)), color(hsl.integer(239, 70, 32)), broad.mul(0.43).add(thread.mul(0.2))), color(hsl.integer(70, 71, 67)), motif.mul(0.91)).add(color(hsl.integer(32, 76, 51)).mul(center).mul(0.24))
    this.metalnessNode = motif.mul(0.85).add(0.04)
    this.roughnessNode = float(0.78).sub(motif.mul(0.48)).sub(grazing.mul(0.15))
    this.anisotropy = 0.66
    this.anisotropyRotation = Math.PI / 2
    this.sheenNode = float(0.32)
    this.sheenRoughness = 0.7
    this.normalNode = proceduralNormal(thread.mul(0.27).add(motif.mul(0.48)).add(noise.mul(0.11)), 0.0012)
    this.emissiveNode = color(hsl.integer(74, 100, 87)).mul(motif).mul(glimmer).mul(0.23).add(color(hsl.integer(237, 63, 85)).mul(thread).mul(near).mul(0.027)).add(color(hsl.integer(239, 42, 52)).mul(grazing.pow(3)).mul(0.1))
  }
}
