import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Bone porcelain drawn with ink stripes on the glaze and an identical set just beneath it. Parallax between the layers creates moiré: from far away the whole sculpture flickers between lined and blank as you turn, up close the fringes multiply across the surface. Where the stripes cancel, gold leaf shines through. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {p, view, facing, grazing, intimate} = viewerFrame()
    const depth = 0.055
    const inner = p.sub(view.mul(depth))
    const k1 = vec3(2, 9, 4).normalize()
    const k2 = vec3(-7, 3, 6).normalize()
    const f1 = 95
    const f2 = 78
    const f3 = 240
    const drift = time.mul(0.35)
    const stripes = (q: Node<'vec3'>, k: Node<'vec3'>, f: number) => opticalBands(q.dot(k).mul(f).add(drift))
    const familyA = stripes(p, k1, f1).add(stripes(inner, k1, f1)).sub(1)
    const familyB = stripes(p, k2, f2).add(stripes(inner, k2, f2)).sub(1)
    const familyC = stripes(p, k1, f3).add(stripes(inner, k1, f3)).sub(1).mul(intimate)
    const envelopeA = view.dot(k1).mul(f1 * depth * 0.5).cos().abs()
    const envelopeB = view.dot(k2).mul(f2 * depth * 0.5).cos().abs()
    const ink = familyA.smoothstep(0.25, 0.6).max(familyB.smoothstep(0.25, 0.6)).max(familyC.smoothstep(0.35, 0.7).mul(0.7))
    const gold = envelopeA.oneMinus().pow(4).max(envelopeB.oneMinus().pow(4))
    const porcelain = color(hsl.integer(83, 43, 93))
    const goldLeaf = color(hsl.integer(91, 82, 73))
    const base = mix(porcelain, color(hsl.integer(285, 17, 6)), ink.mul(0.92))
    this.colorNode = mix(base, goldLeaf, gold.mul(0.9))
    this.metalnessNode = gold.mul(0.9)
    this.roughnessNode = float(0.16).mix(0.3, ink).mix(0.12, gold)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(ink.mul(0.6).add(gold.mul(0.3)), 0.0007)
    this.emissiveNode = goldLeaf.mul(gold).mul(grazing.mul(0.5).add(0.15)).mul(0.6).add(porcelain.mul(facing.pow(30)).mul(0.08))
  }
}
