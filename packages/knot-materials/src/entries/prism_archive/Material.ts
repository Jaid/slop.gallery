import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, negateOnBackSide, time, uv, vec2, vec3} from 'three/tsl'

import {resolved, ruled, stroke, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Tangent-frame perturbation for deliberately planar, optically distinct microfacets. */
function facetNormal(x: Node<'float'>, y: Node<'float'>) {
  const {tangent, bitangent, normal} = exhibitionFrame()
  return normal.add(tangent.mul(x)).add(bitangent.mul(y)).normalize()
}
/** An embossed diffraction foil: paired triangular blaze angles and an angularly multiplexed engraving. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {near, intimate, grazing, facing, V, tangent, bitangent} = exhibitionFrame()
    const grid = uv().mul(vec2(48, 6))
    const q = grid.fract()
    const aa = grid.fwidth().length()
    const split = q.x.sub(q.y).smoothstep(aa.negate(), aa)
    const id = wrapCell(grid.floor(), vec2(48, 6))
    const random = cellNoiseVec3(vec3(id, 31))
    const edgeDistance = q.x.min(q.x.oneMinus()).min(q.y.min(q.y.oneMinus())).min(q.x.sub(q.y).abs().mul(0.707))
    const bevel = edgeDistance.smoothstep(0.005, 0.055)
    const facetX = split.mul(0.38).sub(0.19).add(random.x.sub(0.5).mul(0.12)).mul(bevel)
    const facetY = split.mul(-0.3).add(0.15).add(random.y.sub(0.5).mul(0.12)).mul(bevel)
    this.normalNode = negateOnBackSide(facetNormal(facetX, facetY))
    const viewAcross = V.dot(tangent)
    const viewAlong = V.dot(bitangent)
    const blaze = viewAcross.mul(9.5).add(viewAlong.mul(5.5)).add(split.mul(1.6)).add(random.z.mul(1.2))
    const phase = blaze.add(uv().y.mul(TAU * 2)).add(time.mul(0.12).sin().mul(0.24))
    const spectrum = spectralColor(phase).pow(1.6)
    const order = wave(viewAcross.mul(16).sub(viewAlong.mul(9)).add(random.z.mul(3))).mul(0.48).add(0.35)
    const silver = mix(color(hsl.integer(237, 18, 57)), color(hsl.integer(234, 12, 92)), facing.mul(0.7))
    const foil = mix(silver, spectrum, order.mul(bevel.mul(0.65).add(0.3)))
    // A hidden second image moves in the opposite direction: nested diamond seals.
    const lens = grid.add(vec2(viewAcross, viewAlong).mul(0.22)).fract().sub(0.5)
    const diamond = lens.x.abs().add(lens.y.abs())
    const seal = ruled(diamond.mul(6).add(blaze.mul(0.08)), 0.07).mul(resolved(grid)).mul(0.3)
    const perimeter = stroke(edgeDistance.sub(0.032), 0.007, aa)
    const microprint = ruled(uv().x.mul(1800).add(uv().y.mul(240)), 0.11).mul(intimate)
    this.colorNode = mix(foil.mul(seal.mul(-0.3).add(1)), color(hsl.integer(159, 14, 90)), perimeter.mul(0.7))
      .mul(microprint.mul(-0.055).add(1))
    this.metalness = 0.94
    this.roughnessNode = float(0.2).add(bevel.oneMinus().mul(0.15)).sub(near.mul(0.025))
    this.anisotropyNode = vec2(0.62, 0.18)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.12
    this.iridescenceNode = bevel.mul(0.75)
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = split.mul(180).add(random.x.mul(120)).add(190)
    this.emissiveNode = spectrum.mul(order).mul(seal.add(perimeter.mul(0.2))).mul(grazing.mul(0.5).add(0.5)).mul(0.1)
  }
}
