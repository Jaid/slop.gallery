import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {hairline as opticalLine} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function wrap01(x: Node<'float'>) {
  return x.fract().sub(0.5).abs().oneMinus()
}

/** A deep-sea choir: rows of photophores ignite in a travelling cascade when something draws near, and a lone lure wanders the skin forever. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const ribs = tube.x.mul(Math.PI * 2 * 34).sin().mul(0.5).add(0.5)
    const rows = opticalLine(tube.y.mul(Math.PI * 2 * 5).sin(), 0.2)
    const sites = opticalLine(tube.x.mul(Math.PI * 2 * 46).sin(), 0.3)
    const photophores = rows.mul(sites)
    const organRnd = cellNoiseVec3(p.mul(7)).x
    const organTint = mix(color(hsl.integer(219, 100, 79.6)), color(hsl.integer(181, 100, 93.7)), organRnd)
    const front = tube.x.sub(time.mul(0.16)).fract()
    const flash = front.smoothstep(0.05, 0.42).oneMinus()
    const excite = time.mul(16).add(tube.x.mul(Math.PI * 2 * 46)).sin().mul(0.5).add(0.5)
    const breath = time.mul(0.7).sin().mul(0.25).add(0.75)
    const lureD2 = wrap01(tube.x.sub(time.mul(0.085).fract())).mul(6).pow(2).add(wrap01(tube.y.sub(time.mul(0.31).fract())).pow(2))
    const lure = lureD2.mul(-60).exp()
    const mottle = mx_noise_float(p.mul(3)).mul(0.5).add(0.5)
    this.colorNode = mix(mix(color(hsl.integer(263, 28, 4)), color(hsl.integer(254, 44, 14)), mottle.mul(0.6).add(ribs.mul(0.25))), color(hsl.integer(220, 72, 21)), grazing.pow(2).mul(0.5))
    this.metalness = 0.05
    this.roughnessNode = ribs.mul(0.12).add(0.46)
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.28
    this.normalNode = proceduralNormal(ribs, 0.0016)
    this.emissiveNode = organTint.mul(photophores.mul(breath.mul(0.25).add(flash.mul(2.4).mul(near)).add(intimate.mul(excite).mul(0.6)))).add(organTint.mul(rows).mul(0.08)).add(mix(color(hsl.integer(238, 99, 71)), color(hsl.integer(210, 100, 97)), lure).mul(lure).mul(3.2)).add(color(hsl.integer(263, 100, 51.2)).mul(grazing.pow(2)).mul(0.22))
  }
}
