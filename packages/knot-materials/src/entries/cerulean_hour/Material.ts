import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {approach, disk, wave} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {inkLine as stroke} from '../../lib/atelier.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Cobalt wave fans and gold crests lie beneath a crazed porcelain glaze, with granulation revealed on approach. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, facing, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const tube = uv()
    const q = tube.mul(vec2(28, 6))
    const local = q.add(vec2(q.y.floor().mod(2).mul(0.5), 0)).fract()
    const fanPoint = vec2(local.x.sub(0.5), local.y.mul(0.74).add(0.08))
    const radius = fanPoint.length()
    const aa = q.fwidth().length().max(0.0001)
    const fan = disk(radius, 0.72, aa)
    const granulation = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
    const wash = mx_noise_float(p.mul(28)).mul(0.5).add(0.5)
    const brush = wave(radius.mul(TAU * 8.5).add(wash.mul(0.35))).smoothstep(-0.18, 0.5).mul(fan)
    const crest = stroke(radius.sub(0.718), 0.009, aa)
    const innerGold = stroke(radius.sub(0.48), 0.003, aa).mul(fan)
    const gold = crest.max(innerGold.mul(0.75))
    const porcelain = mix(color(hsl.integer(162, 18, 89)), color(hsl.integer(85, 100, 96)), wash.mul(0.6).add(0.3))
    const cobalt = mix(color(hsl.integer(262, 90, 10)), color(hsl.integer(251, 78, 29)), wash.mul(0.6).add(granulation.mul(0.3)))
    const cracks = cellularBoundary(p.mul(115))
    const craze = cracks.smoothstep(0.007, 0.028).oneMinus().mul(near).mul(p.mul(115).fwidth().length().smoothstep(0.2, 1).oneMinus())
    const glaze = mix(porcelain, cobalt, brush.mul(granulation.mul(0.065).add(0.935)))
    this.colorNode = mix(glaze.mul(craze.mul(-0.12).add(1)), color(hsl.integer(78, 71, 65)), gold)
    this.metalnessNode = gold.mul(0.82)
    this.roughnessNode = mix(float(0.19), float(0.25), brush).sub(gold.mul(0.08)).add(granulation.mul(0.035))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.ior = 1.5
    const relief = brush.mul(0.00014).add(gold.mul(0.00055)).add(wash.mul(0.0007)).sub(craze.mul(0.00012))
    this.normalNode = proceduralNormal(relief, 0.6)
    this.clearcoatNormalNode = proceduralNormal(wash.mul(0.00065), 0.6)
    // A very faint, traveling reflection under the glaze; the hand-painted wave pattern stays still.
    const shimmer = tube.x.mul(TAU * 5).add(facing.mul(13)).sub(time.mul(0.35)).cos().smoothstep(0.8, 1)
    this.emissiveNode = color(hsl.integer(238, 86, 57)).mul(shimmer).mul(brush).mul(grazing.mul(0.65).add(0.2)).mul(near).mul(0.22)
  }
}
