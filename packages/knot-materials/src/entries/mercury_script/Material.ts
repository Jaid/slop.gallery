import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black lacquer inlaid with mercury. The inscription is pseudo-calligraphy laid on the tube in object space, so the hand wraps the knot without a UV seam. Parallax lifts the metal a fraction out of the groove. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.4)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const along = p.dot(vec3(2.1, 7.4, -1.6))
    const around = p.dot(vec3(-4.8, 1.2, 6.5))
    const page = vec2(along, around).mul(1.15)
    const slope = view.mul(0.55)
    // Move the whole page before selecting cells, rather than clipping displaced letters.
    const shiftedPage = page.sub(vec2(slope.dot(vec3(0.4, 1, 0)), slope.dot(vec3(-1, 0.2, 0.8))))
    const cell = shiftedPage.floor()
    const ink = shiftedPage.fract().sub(0.5)
    const id = cellNoiseVec3(vec3(cell.x, cell.y, 5.3))
    // Filter from continuous coordinates, not discontinuous cell-local glyph fields.
    const footprint = shiftedPage.fwidth().length()
    const aa = footprint.max(0.00005).min(0.04)
    const screenFill = (field: Node<'float'>) => field.smoothstep(aa.negate(), aa).oneMinus()
    const screenRibbon = (field: Node<'float'>, width: number) => field.abs().smoothstep(width * 0.35, aa.add(width)).oneMinus()
    const glyphSupport = ink.x.abs().max(ink.y.abs()).smoothstep(0.43, 0.49).oneMinus().mul(footprint.smoothstep(0.2, 0.65).oneMinus())
    const lean = id.y.mul(1.1).sub(0.55)
    const stemField = ink.x.mul(lean.mul(0.6).add(1)).sub(ink.y.mul(lean))
    const stem = screenRibbon(stemField, 0.055).mul(screenFill(ink.y.abs().sub(0.4)))
    const bowlCenter = vec2(id.x.mul(0.16).sub(0.08), -0.12)
    const bowlPoint = ink.sub(bowlCenter)
    const bowlRadius = bowlPoint.length()
    const bowl = screenFill(bowlRadius.sub(0.2)).mul(screenFill(bowlPoint.y.add(0.05)))
    const hook = screenRibbon(bowlRadius.sub(0.24), 0.02).mul(screenFill(bowlPoint.y.negate().sub(0.02))).mul(id.x.smoothstep(0.25, 0.4))
    const wave = ink.x.mul(6.5).add(id.z.mul(4)).sin().mul(0.09)
    const flourish = screenRibbon(ink.y.sub(wave).sub(0.22), 0.016).mul(screenFill(ink.x.abs().sub(0.36))).mul(id.z.smoothstep(0.35, 0.5))
    const dot = screenFill(ink.sub(vec2(0.22, 0.28)).length().sub(0.055)).mul(id.y.smoothstep(0.6, 0.72))
    const glyph = stem.max(bowl).max(hook).max(flourish).max(dot).mul(glyphSupport)
    const lacquerGrain = mx_noise_float(p.mul(22)).mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(295, 24, 4)), color(hsl.integer(62, 20, 10)), lacquerGrain.mul(0.55).add(grazing.mul(0.1)))
    const mercury = mix(color(hsl.integer(250, 20, 83)), color(hsl.integer(0, 0, 100)), facing.pow(0.4))
    const warm = mix(mercury, color(hsl.integer(85, 63, 90)), id.x.mul(0.4))
    this.colorNode = mix(lacquer, warm, glyph)
    this.normalNode = proceduralNormal(glyph.mul(-0.012).add(lacquerGrain.mul(0.001)), 1.2)
    this.metalnessNode = mix(float(0.02), float(1), glyph)
    this.roughnessNode = mix(float(0.14), float(0.03), glyph).clamp(0.02, 0.24)
    this.clearcoatNode = mix(float(1), float(0.12), glyph)
    this.clearcoatRoughness = 0.028
    this.anisotropyNode = vec2(lean.mul(glyph), 1).normalize().mul(glyph.mul(0.9).add(0.08))
    this.iridescenceNode = glyph.oneMinus().mul(grazing.pow(1.6)).mul(0.85)
    this.iridescenceIOR = 1.85
    this.iridescenceThicknessNode = lacquerGrain.mul(260).add(60)
    const pulse = time.mul(0.45).add(id.z.mul(9)).add(along).sin().mul(0.5).add(0.5)
    const meniscus = screenRibbon(bowlRadius.sub(0.19), 0.022).mul(bowl)
    this.emissiveNode = color(hsl.integer(262, 100, 97.4)).mul(glyph).mul(pulse).mul(near).mul(0.22).add(color(hsl.integer(0, 0, 100)).mul(meniscus).mul(facing).mul(0.45)).add(color(hsl.integer(256, 63, 90)).mul(flourish.add(hook)).mul(intimate).mul(0.16)).add(color(hsl.integer(251, 28, 72)).mul(dot).mul(0.3)).mul(glyphSupport)
  }
}
