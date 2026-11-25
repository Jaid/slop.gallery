import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, time, uv, vec2} from 'three/tsl'

import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {opticalBands, proceduralNormal, TAU, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = data.id
    const {view, near} = viewerFrame()
    const q = uv().mul(vec2(12, 2))
    const c = q.fract().sub(0.5)
    const aa = q.fwidth().length().mul(0.6)
    const r = c.length()
    const theta = mx_atan2(c.y, c.x.add(0.000001)) as unknown as Node<'float'>
    const turn = view.x.mul(2).add(view.z.mul(1.4)).add(time.mul(0.16))
    const petalRadius = theta.mul(5).add(turn).cos().mul(0.085).add(0.24)
    const bloom = inkFill(r.sub(petalRadius), aa)
    const rings = opticalBands(r.mul(120).sub(turn.mul(3)))
    const iris = inkFill(r.sub(0.07), aa)
    const outer = inkLine(r.sub(0.405), 0.005, aa)
    const printA = mix(color(hsl.integer(95, 39, 92)), color(hsl.integer(245, 59, 13)), bloom.mul(rings.mul(0.7).add(0.3)))
    const printB = mix(color(hsl.integer(31, 97, 61.6)), color(hsl.integer(240, 61, 11)), bloom.oneMinus())
    // Lenticular channels select between two deliberately different plates as the eye moves.
    const selector = view.x.mul(5).add(view.z.mul(3)).add(uv().y.mul(TAU * 2)).sin().smoothstep(-0.08, 0.08)
    const graphic = mix(printA, printB, selector)
    const registration = inkLine(c.x.abs().add(c.y.abs()).sub(0.64), 0.006, aa)
    const ink = mix(graphic, color(hsl.integer(124, 100, 93.9)), iris.max(outer).max(registration))
    const lensPhase = uv().x.mul(TAU * 768)
    const lenses = opticalBands(lensPhase)
    this.colorNode = ink
    this.metalness = 0.12
    this.roughnessNode = float(0.27).add(lenses.mul(0.045))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.14
    this.anisotropy = 0.5
    this.normalNode = proceduralNormal(lenses.mul(near).mul(0.000035), 1)
    const buried = q.sub(tubeRay().mul(vec2(12, 2)).mul(0.018)).fract().sub(0.5).length()
    this.emissiveNode = color(hsl.integer(124, 100, 93.9)).mul(inkLine(buried.sub(0.405), 0.003, aa)).mul(selector).mul(near).mul(0.2)
  }
}
