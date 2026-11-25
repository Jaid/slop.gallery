import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2} from 'three/tsl'

import {approach, disk, wave} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {inkLine as stroke} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Jacquard feathers are woven into the cloth, not printed on a glossy substrate. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {facing, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const q = tube.mul(vec2(32, 4))
    const point = q.add(vec2(q.y.floor().mod(2).mul(0.5), 0)).fract().sub(0.5)
    const aa = q.fwidth().length().max(0.0001)
    const y = point.y.mul(2.1)
    const x = point.x.add(y.sin().mul(0.085))
    const shape = x.abs().mul(3.1).add(y.abs().pow(1.7)).sub(0.83)
    const feather = shape.smoothstep(aa.negate(), aa).oneMinus()
    const edge = stroke(shape, 0.024, aa.mul(3))
    const spine = stroke(x, 0.012, aa).mul(feather)
    const barbs = wave(x.abs().mul(105).sub(y.mul(39))).mul(0.5).add(0.5).mul(feather)
    const warp = wave(tube.x.mul(TAU * 1152))
    const weft = wave(tube.y.mul(TAU * 144))
    const weave = warp.mul(weft).mul(0.5).add(0.5)
    // Two dye baths trade places across the nap. Slow motion is an optical breath, not sliding cloth.
    const shift = facing.mul(2.4).add(tube.y.mul(TAU * 2).sin().mul(0.4)).add(time.mul(0.18).sin().mul(0.12)).smoothstep(0.4, 2)
    const silk = mix(color(hsl.integer(259, 62, 11)), color(hsl.integer(200, 87, 40)), shift)
    const motif = mix(color(hsl.integer(228, 58, 34)), color(hsl.integer(173, 39, 64)), grazing.mul(0.6).add(barbs.mul(0.3)))
    const eyeRadius = vec2(x.mul(2.7), y.sub(0.24)).length()
    const eye = stroke(eyeRadius.sub(0.19), 0.017, aa.mul(2.7)).mul(feather)
    const eyeCore = disk(eyeRadius, 0.105, aa.mul(2.7)).mul(feather)
    const gold = edge.add(spine.mul(0.8)).add(eye).clamp()
    this.colorNode = mix(mix(mix(silk, motif, feather.mul(0.87)), color(hsl.integer(268, 65, 13)), eyeCore), color(hsl.integer(74, 65, 71)), gold).mul(weave.mul(0.14).add(0.86))
    this.metalnessNode = mix(float(0.12), float(0.74), gold)
    this.roughnessNode = mix(float(0.42), float(0.28), gold).sub(barbs.mul(0.06))
    this.anisotropy = 0.85
    this.anisotropyNode = mix(vec2(0.87, 0.08), vec2(0.15, 0.83), feather)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(228, 77, 47)), color(hsl.integer(87, 39, 72)), feather).mul(0.65)
    this.sheenRoughness = 0.36
    const relief = warp.mul(0.000065).add(weft.mul(0.000065)).mul(near).add(edge.mul(0.00035)).add(barbs.mul(0.00012))
    this.normalNode = proceduralNormal(relief, 0.65)
    this.aoNode = weave.mul(0.14).add(0.86)
    this.emissiveNode = silk.mul(grazing.pow(3)).mul(0.018)
  }
}
