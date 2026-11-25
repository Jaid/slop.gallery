import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2} from 'three/tsl'

import {band, disk, segment} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tile = uv().mul(vec2(11, 3))
    const p = tile.fract().sub(0.5)
    const aa = tile.fwidth().length().mul(0.65).max(0.0001)
    const {near, grazing} = viewerFrame()
    let embroidery: Node<'float'> = float(0)
    const stem = [[-0.32, -0.42], [-0.19, -0.19], [-0.1, 0.06], [0.07, 0.25], [0.25, 0.42]] as const
    for (let i = 0;i < stem.length - 1;i++) {
      embroidery = embroidery.max(segment(p, stem[i], stem[i + 1], 0.006, aa))
    }
    const branches = [
      [[-0.26, -0.31], [-0.39, -0.08]],
      [[-0.19, -0.19], [-0.02, -0.25]],
      [[-0.1, 0.06], [-0.3, 0.2]],
      [[0.07, 0.25], [0.3, 0.15]],
    ] as const
    for (const [a, b] of branches) {
      embroidery = embroidery.max(segment(p, a, b, 0.004, aa))
    }
// Almond-shaped satin-stitch leaves, assembled from two tapered arcs rather than decals.
    const leaves = [[-0.35, -0.06, -1], [-0.01, -0.26, 1], [-0.28, 0.22, -1], [0.31, 0.13, 1]] as const
    let satin: Node<'float'> = float(0)
    for (const [x, y, side] of leaves) {
      const q = p.sub(vec2(x, y))
      const shape = q.x.add(q.y.mul(0.34 * side)).div(0.095).pow2().add(q.y.div(0.13).pow2())
      const leaf = shape.smoothstep(0.7, 1.15).oneMinus()
      satin = satin.max(leaf)
      embroidery = embroidery.max(segment(p, [x, y - 0.09], [x, y + 0.09], 0.002, aa).mul(leaf))
    }
    const berry = disk(p.sub(vec2(0.25, 0.39)), 0.034, aa)
    const pile = band(uv().x.mul(1270).add(uv().y.mul(211))).mul(near)
    this.colorNode = mix(color(hsl.integer(331, 61, 7)), color(hsl.integer(358, 58, 23)), grazing.mul(0.46).add(pile.mul(0.055)))
    this.colorNode = mix(this.colorNode, color(hsl.integer(77, 48, 69)), embroidery.mul(0.68).add(satin.mul(0.33)).clamp())
    this.colorNode = mix(this.colorNode, color(hsl.integer(11, 85, 33)), berry)
    this.metalnessNode = embroidery.mul(0.74)
    this.roughnessNode = embroidery.mul(-0.47).add(0.83).sub(pile.mul(0.06))
    this.sheen = 1
    this.sheenColor.set(hsl.integer(6, 69, 46.5))
    this.sheenRoughness = 0.58
    this.clearcoatNode = embroidery.mul(0.55)
    this.normalNode = proceduralNormal(embroidery.mul(0.0027).add(satin.mul(0.0018)).add(pile.mul(0.0004)), 1)
    this.emissiveNode = color(hsl.integer(73, 53, 74)).mul(embroidery).mul(grazing.pow(2)).mul(0.18)
  }
}
