import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** An ammonite suspended behind the transparent, honey-colored skin of a much older sea. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
    const front = tile(uv(), 5, 2).sub(vec2(0.5, 0.5))
    const back = tile(uv().add(vec2(view.x.mul(0.009), view.y.mul(0.015))), 5, 2).sub(vec2(0.5, 0.5))
    const r = back.length().max(0.003)
    const angle = mx_atan2(back.y, back.x) as Node<'float'>
    const shell = r.smoothstep(0.43, 0.46).oneMinus()
    const center = r.smoothstep(0.012, 0.027).oneMinus()
    const spiral = stroke(angle.add(r.log().mul(4.25)).sin().mul(r), 0.018).mul(shell)
    const rib = angle.mul(27).add(r.mul(17)).sin().abs().pow(12).mul(r.smoothstep(0.1, 0.14)).mul(shell)
    const shellEdge = stroke(r.sub(0.425), 0.012)
    const amberGrain = mx_noise_float(p.mul(8)).mul(0.5).add(0.5)
    const ancientClouds = mx_noise_float(p.mul(3).add(vec3(0, time.mul(0.012), 0))).mul(0.5).add(0.5)
    const lens = front.length().smoothstep(0.28, 0.46).oneMinus()
    const gleam = front.y.mul(25).add(front.x.mul(11)).add(time.mul(0.65)).sin().mul(0.5).add(0.5).pow(12).mul(lens)
    const caustic = p.x.mul(19).add(p.y.mul(11)).add(time.mul(0.72)).sin().abs().pow(15).mul(p.z.mul(15).sub(time.mul(0.38)).sin().mul(0.5).add(0.5))
    this.colorNode = mix(color(hsl.integer(43, 61, 20)), color(hsl.integer(65, 84, 68)), amberGrain.mul(0.58).add(ancientClouds.mul(0.34))).add(color(hsl.integer(81, 100, 85.7)).mul(shellEdge).mul(0.25))
    this.metalness = 0.08
    this.transmission = 0.24
    this.thickness = 0.55
    this.ior = 1.5
    this.attenuationColor.set(hsl.integer(54, 90, 66))
    this.attenuationDistance = 1.3
    this.roughnessNode = float(0.11).add(amberGrain.mul(0.07))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.normalNode = proceduralNormal(amberGrain.mul(0.18).add(lens.mul(0.26)), 0.0008)
    this.emissiveNode = color(hsl.integer(85, 75, 89.4)).mul(spiral.mul(0.62).add(center.mul(0.75)).add(rib.mul(0.19)).add(shellEdge.mul(0.33))).mul(near.mul(0.35).add(0.65)).add(color(hsl.integer(76, 100, 83)).mul(gleam).mul(0.22)).add(color(hsl.integer(78, 100, 84.7)).mul(caustic).mul(0.24)).add(color(hsl.integer(70, 100, 88)).mul(grazing.pow(4)).mul(0.19))
  }
}
