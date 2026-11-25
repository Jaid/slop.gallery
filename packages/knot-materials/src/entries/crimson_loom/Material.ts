import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {detail, fill, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Cut velvet and raised silk damask. The warp and weft exchange both height and anisotropic direction. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(12, 2))
    const local = q.fract().sub(0.5)
    const radius = local.length()
    const angle = mx_atan2(local.y, local.x.add(0.00001)) as unknown as Node<'float'>
    const fw = q.fwidth().length().max(0.0001)
    const contour = radius.sub(angle.mul(4).cos().mul(0.063).add(0.27))
    const brocade = stroke(contour, 0.024, fw)
    const inner = stroke(contour.add(0.075), 0.012, fw)
    const heart = fill(radius.sub(angle.mul(4).cos().mul(0.028).add(0.085)), fw)
    const vineField = local.x.abs().sub(local.y.mul(TAU).cos().mul(0.12).add(0.29))
    const vine = stroke(vineField, 0.014, fw).mul(radius.smoothstep(0.3, 0.42))
    const embroidery = brocade.max(inner.mul(0.8)).max(heart).max(vine)
    const threads = tube.mul(vec2(1536, 192))
    const threadId = threads.floor()
    const threadLocal = threads.fract().sub(0.5)
    const resolved = detail(threads)
    const over = threadId.x.add(threadId.y).mod(2)
    const warp = threadLocal.x.mul(Math.PI).cos().max(0).pow(0.7)
    const weft = threadLocal.y.mul(Math.PI).cos().max(0).pow(0.7)
    const yarn = mix(warp, weft, over).mul(resolved).add(resolved.oneMinus().mul(0.72))
    const direction = mix(vec2(0.82, 0), vec2(0, 0.82), over.mul(resolved))
    const nap = tube.x.mul(TAU * 4).add(tube.y.mul(TAU * 2)).add(time.mul(0.19)).sin().mul(0.5).add(0.5)
    const velvet = mix(color(hsl.integer(350, 60, 9)), color(hsl.integer(16, 88, 32)), facing.pow(0.7).mul(0.65).add(nap.mul(0.2)))
    const gold = mix(color(hsl.integer(69, 50, 51)), color(hsl.integer(82, 62, 86)), grazing.mul(0.5).add(nap.mul(0.3)))
    const fiberVariation = mx_noise_float(p.mul(100)).mul(0.05).add(0.95)
    this.colorNode = mix(velvet, gold, embroidery).mul(yarn.mul(0.25).add(0.75)).mul(fiberVariation)
    this.metalnessNode = embroidery.mul(0.55)
    this.roughnessNode = mix(float(0.62), float(0.3), embroidery)
    this.anisotropy = 0.82
    this.anisotropyNode = direction.mul(embroidery.mul(0.35).add(0.65))
    this.sheenNode = mix(color(hsl.integer(5, 70, 48)), color(hsl.integer(90, 100, 95)), embroidery).mul(0.7)
    this.sheenRoughnessNode = mix(float(0.52), float(0.3), embroidery)
    this.normalNode = proceduralNormal(embroidery.mul(0.00095).add(yarn.mul(0.00022)).add(wave(tube.x.mul(TAU * 384)).mul(0.000025)), 1)
    this.aoNode = yarn.mul(0.22).add(0.78)
    this.clearcoat = 0
  }
}
