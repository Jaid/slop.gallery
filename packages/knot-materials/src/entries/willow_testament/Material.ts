import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {inkFill, inkLine} from '../../lib/atelier.ts'
import {opticalBands, proceduralNormal, TAU, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = data.id
    const {p, view, near, grazing} = viewerFrame()
    const q = uv().mul(vec2(24, 3))
    const local = q.fract().sub(0.5)
    const aa = q.fwidth().length().mul(0.6)
    const r = local.length()
    const theta = mx_atan2(local.y, local.x.add(0.000001)) as unknown as Node<'float'>
    const petals = theta.mul(6).cos().mul(0.052).add(0.205)
    const outline = r.sub(petals)
    const bloom = inkFill(outline, aa)
    const petalEdge = inkLine(outline, 0.009, aa)
    const eye = inkFill(r.sub(0.039), aa)
    const veins = inkLine(theta.mul(6).sin().mul(r), 0.006, aa).mul(bloom).mul(r.smoothstep(0.045, 0.08))
    // A continuous serpentine vine crosses behind each six-petaled blossom.
    const vineField = local.y.sub(local.x.mul(TAU).sin().mul(0.35))
    const vine = inkLine(vineField, 0.012, aa).mul(bloom.oneMinus())
    const leafCenter = vec2(local.x.abs().sub(0.345), local.y.sub(local.x.sign().mul(0.22)))
    const leafShape = leafCenter.x.div(0.09).pow(2).add(leafCenter.y.div(0.16).pow(2)).sub(1)
    const leaves = inkFill(leafShape, aa.mul(12)).mul(bloom.oneMinus())
    const pigment = mx_noise_float(p.mul(80)).mul(0.18).add(mx_noise_float(p.mul(18)).mul(0.25)).add(0.67).clamp()
    const wash = bloom.max(petalEdge).max(veins).max(vine).max(leaves).clamp()
    const blue = mix(color(hsl.integer(263, 86, 12)), color(hsl.integer(261, 83, 30)), pigment)
    const porcelain = mix(color(hsl.integer(103, 26, 93)), color(hsl.integer(98, 54, 97.4)), mx_noise_float(p.mul(3)).mul(0.2).add(0.6))
    const rim = inkLine(r.sub(0.32), 0.006, aa).mul(local.y.abs().smoothstep(0.24, 0.31).oneMinus())
    const gold = eye.max(rim).max(inkLine(outline.sub(0.015), 0.005, aa))
    const brush = opticalBands(r.mul(460).add(theta.mul(6))).mul(bloom).mul(near)
    this.colorNode = mix(mix(porcelain, blue, wash), color(hsl.integer(80, 79, 71)), gold)
    this.metalnessNode = gold.mul(0.92)
    this.roughnessNode = mix(float(0.24), float(0.29), gold).add(brush.mul(0.025))
    this.clearcoat = 0.75
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(wash.mul(0.00022).add(gold.mul(0.0008)).add(mx_noise_float(p.mul(110)).mul(near).mul(0.000035)), 1)
    this.emissiveNode = color(hsl.integer(79, 79, 78)).mul(gold).mul(view.x.mul(7).add(q.y.mul(TAU)).sub(time.mul(0.55)).sin().smoothstep(0.75, 1)).mul(grazing).mul(0.22)
  }
}
