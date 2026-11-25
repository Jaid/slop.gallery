import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {inkFill, inkLine} from '../../lib/atelier.ts'
import {opticalBands, proceduralNormal, TAU, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = data.id
    const {p, view, near, grazing} = viewerFrame()
    const q = uv().mul(vec2(20, 3))
    const aa = q.fwidth().length().mul(0.65)
    const c = q.fract().sub(0.5)
    // Heraldic ogees, each carrying an embroidered lily and suspended pearls.
    const ogee = c.x.abs().sub(c.y.mul(TAU).cos().mul(0.105).add(0.28))
    const border = inkLine(ogee, 0.011, aa)
    const innerBorder = inkLine(ogee.add(0.035), 0.004, aa)
    const lily = c.x.abs().div(0.105).add(c.y.add(0.035).div(0.28).pow(2)).sub(1)
    const side = vec2(c.x.abs().sub(0.13).add(c.y.mul(0.3)), c.y.add(0.045))
    const sideLily = side.x.div(0.058).pow(2).add(side.y.div(0.145).pow(2)).sub(1)
    const flower = inkLine(lily.mul(0.1), 0.008, aa).max(inkLine(sideLily.mul(0.05), 0.006, aa))
    const stem = inkLine(c.x, 0.008, aa).mul(inkFill(c.y.abs().sub(0.24), aa))
    const pearl = inkFill(vec2(c.x, c.y.sub(0.365)).length().sub(0.023), aa)
    const embroidery = border.max(innerBorder).max(flower).max(stem).max(pearl)
    const thread = opticalBands(q.x.add(q.y).mul(TAU * 65))
    const nap = opticalBands(uv().x.mul(TAU * 1500)).mul(opticalBands(uv().y.mul(TAU * 200)))
    const pile = mx_noise_float(p.mul(65)).mul(0.08).add(0.92)
    const angle = view.x.mul(3).add(view.z.mul(2)).add(uv().y.mul(TAU)).sin().mul(0.5).add(0.5)
    const velvet = mix(color(hsl.integer(340, 45, 7)), color(hsl.integer(10, 89, 27)), angle.mul(0.7).add(grazing.mul(0.2))).mul(pile)
    const gold = mix(color(hsl.integer(63, 74, 41)), color(hsl.integer(82, 66, 80)), thread.mul(0.4).add(0.45))
    this.colorNode = mix(velvet, gold, embroidery)
    this.metalnessNode = embroidery
    this.roughnessNode = mix(float(0.88), float(0.25), embroidery)
    this.sheen = 1
    this.sheenNode = color(hsl.integer(17, 87, 31.5)).mul(embroidery.oneMinus()).mul(angle.mul(0.25).add(0.35))
    this.sheenRoughness = 0.38
    this.anisotropy = 0.6
    this.anisotropyNode = vec2(0.65, 0.25).mul(embroidery)
    this.normalNode = proceduralNormal(embroidery.mul(thread.mul(0.2).add(0.8)).mul(0.0018).add(nap.mul(near).mul(0.00005)), 1)
    const traveling = q.x.mul(TAU / 2).add(q.y.mul(TAU)).sub(time.mul(0.7)).add(view.x.mul(3)).sin().smoothstep(0.92, 1)
    this.emissiveNode = color(hsl.integer(74, 100, 82)).mul(pearl).mul(traveling).mul(near).mul(0.3)
  }
}
