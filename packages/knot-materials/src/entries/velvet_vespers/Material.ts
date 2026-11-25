import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {coverage, segment, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Large acanthus damask, raised silk threads and a dark, directionally brushed velvet pile. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, grazing, intimate, view} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(12, 2))
    const aa = q.fwidth().length().max(0.0001)
    const c = q.fract().sub(0.5)
    const stemX = c.x.sub(c.y.mul(Math.PI * 2).sin().mul(0.045))
    let foliage: Node<'float'> = float(0)
    let veins: Node<'float'> = float(0)
    // Tapered, curved lanceolate leaves grow from a continuous rachis; no concentric target motifs.
    for (let i = 0; i < 5; i++) {
      const y = -0.3 + i * 0.135
      const span = 0.2 * Math.sin((i + 1) / 6 * Math.PI)
      const leafPoint = vec2(stemX.abs(), c.y.sub(y))
      const along = leafPoint.dot(vec2(0.83, 0.56))
      const across = leafPoint.dot(vec2(-0.56, 0.83)).add(along.mul(13).sin().mul(0.01))
      const t = along.div(span).clamp()
      const width = t.mul(Math.PI).sin().max(0).pow(0.75).mul(0.052)
      const d = across.abs().sub(width).max(along.negate()).max(along.sub(span))
      const mask = coverage(d, aa)
      foliage = foliage.max(mask)
      veins = veins.max(stroke(across, 0.003, aa).mul(mask))
    }
    const rachis = coverage(segment(vec2(stemX, c.y), vec2(0, -0.44), vec2(0, 0.37)).sub(0.007), aa)
    foliage = foliage.max(rachis)
    const ogeeField = q.x.mul(Math.PI * 2).cos().add(q.y.mul(Math.PI * 2).cos().mul(0.68)).sub(0.28)
    const ogee = stroke(ogeeField, 0.017, ogeeField.fwidth()).mul(foliage.oneMinus())
    const warp = wave(tube.x.mul(Math.PI * 2 * 1152))
    const weft = wave(tube.y.mul(Math.PI * 2 * 144))
    const weave = mix(warp, weft, foliage).mul(0.5).add(0.5)
    const nap = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
    const drift = tube.x.mul(Math.PI * 6).add(tube.y.mul(Math.PI * 2)).sub(time.mul(0.13)).sin().mul(0.5).add(0.5)
    const angleTint = view.y.mul(0.35).add(view.x.mul(0.25)).add(0.5).clamp()
    const darkPile = mix(color(hsl.integer(307, 55, 8)), color(hsl.integer(358, 72, 18)), drift.mul(0.6).add(nap.mul(0.16)))
    const silk = mix(color(hsl.integer(7, 68, 37)), color(hsl.integer(30, 45, 52)), angleTint)
    let damask = mix(darkPile, silk, foliage.mul(0.82))
    damask = mix(damask, color(hsl.integer(67, 49, 58)), ogee.mul(0.48).max(veins.mul(0.35)))
    this.colorNode = damask.mul(weave.mul(0.18).add(0.82))
    this.specularIntensityNode = mix(float(0.12), float(0.85), foliage)
    this.roughnessNode = mix(float(0.95), float(0.36), foliage)
    this.metalness = 0
    this.sheen = 1
    const pileColor = mix(color(hsl.integer(353, 48, 61)), color(hsl.integer(267, 44, 65)), angleTint)
    this.sheenNode = pileColor.mul(foliage.mul(-0.8).add(1))
    this.sheenRoughnessNode = mix(float(0.75), float(0.4), foliage)
    this.anisotropy = 0.8
    this.anisotropyNode = mix(vec2(0.78, 0.04), vec2(0.04, 0.72), foliage)
    const relief = foliage.mul(0.0012).add(ogee.mul(0.0006)).add(weave.mul(0.0003).mul(intimate)).add(nap.mul(0.00015).mul(intimate))
    this.normalNode = proceduralNormal(relief, 0.9)
    this.aoNode = foliage.mul(0.12).add(0.88)
    // The gallery’s diffuse softboxes underrepresent grazing fiber backscatter; this bounded art lobe preserves the nap silhouette.
    const pileLift = grazing.pow(2.7).mul(foliage.mul(-0.7).add(1)).mul(drift.mul(0.22).add(0.78))
    this.emissiveNode = pileColor.mul(pileLift).mul(0.58).mul(weave.mul(0.18).add(0.82))
  }
}
