import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {approach} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Pale fungal lace carries slow subterranean signals beneath a fine web of hyphae and warm, close-range spores. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {p, view, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const warp = mx_noise_float(p.mul(6)).mul(0.2)
    const q = p.mul(13).add(vec3(warp, warp.mul(-0.8), warp.mul(0.4)))
    const boundary = cellularBoundary(q)
    const aa = q.fwidth().length().max(0.001)
    const lace = boundary.smoothstep(0.07, aa.mul(0.6).add(0.19)).oneMinus()
    const roundLace = boundary.div(0.23).clamp().pow2().oneMinus().pow(2)
    const fineQ = p.mul(49).add(warp)
    const fineBoundary = cellularBoundary(fineQ)
    const fineAA = fineQ.fwidth().length()
    const threads = fineBoundary.smoothstep(0.018, fineAA.mul(0.45).add(0.06)).oneMinus().mul(fineAA.smoothstep(0.2, 1).oneMinus()).mul(near)
    const colony = mx_noise_float(p.mul(4).add(7)).mul(0.5).add(0.5)
    const web = lace.max(threads.mul(colony).mul(0.7))
    const subsurface = p.sub(view.mul(0.028))
    const pulse = subsurface.dot(vec3(8, -5, 12)).add(mx_noise_float(subsurface.mul(8)).mul(3)).sub(time.mul(0.63)).sin().mul(0.5).add(0.5).pow(4)
    const sporeQ = p.mul(65)
    const random = cellNoiseVec3(sporeQ.floor())
    const sporeR = sporeQ.fract().sub(random.mul(0.32).add(0.34)).length()
    const sporeAA = sporeQ.fwidth().length().max(0.001)
    const spores = sporeR.smoothstep(0.09, sporeAA.mul(0.6).add(0.15)).oneMinus().mul(random.x.smoothstep(0.62, 0.74)).mul(sporeAA.smoothstep(0.22, 0.8).oneMinus()).mul(near)
    const velvet = mix(color(hsl.integer(304, 40, 13)), color(hsl.integer(341, 21, 32)), colony)
    const chitin = mix(color(hsl.integer(53, 16, 67)), color(hsl.integer(116, 41, 91)), colony.mul(0.7).add(0.25))
    this.colorNode = mix(mix(velvet, chitin, web), color(hsl.integer(56, 62, 72.5)), spores)
    this.metalness = 0
    this.roughnessNode = web.mul(-0.16).add(0.69).sub(spores.mul(0.15))
    this.sheen = 0.55
    this.sheenNode = color(hsl.integer(166, 27, 80)).mul(web.mul(0.4).add(0.15))
    this.sheenRoughness = 0.65
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.38
    const relief = roundLace.mul(0.0032).add(threads.mul(0.00032)).add(spores.mul(0.0007))
    this.normalNode = proceduralNormal(relief, 0.55)
    this.aoNode = web.mul(0.4).add(0.6)
    // The network stays pale. Its recessed substrate and fruiting spores carry the traveling signal.
    this.emissiveNode = mix(color(hsl.integer(338, 59, 42)), color(hsl.integer(56, 100, 80.4)), pulse).mul(pulse.mul(0.4).add(0.07)).mul(lace.oneMinus()).mul(near.mul(0.4).add(0.12))
      .add(color(hsl.integer(84, 100, 90.5)).mul(spores).mul(pulse.mul(0.55).add(0.08)))
      .add(chitin.mul(grazing.pow(4)).mul(0.045))
  }
}
