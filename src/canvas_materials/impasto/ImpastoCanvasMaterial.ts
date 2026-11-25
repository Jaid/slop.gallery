import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {float, luminance, mix, texture, vec2} from 'three/tsl'

import {slopeNormal, textureSlope} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import knifeRelief from './knifeRelief.ts'

/** Thick oil laid on with a palette knife: overlapping ribbons of paint along the contours of the picture, with raised lips and combed ridges. */
export default class ImpastoCanvasMaterial extends CanvasMaterial {
  /** how high the paint stands, against what it was made with */
  readonly depth = 1
  override readonly description = 'Knife impasto: overlapping ribbons of oil paint laid on with a blunt knife along the picture’s contours, with raised lips and combed ridges.'
  /** how wet the thick paint still shines, 0 for matte and 1 for its full gloss */
  readonly gloss = 0.5
  override readonly strength = 0.1
  /** how large the knife’s strokes are, against what they were made with */
  readonly strokeSize = 1
  override readonly title = 'Knife impasto'

  protected override paint(material: MeshPhysicalNodeMaterial, {image, map, size, uvPerMeter}: CanvasSurface) {
    // Flat until the workers have laid the strokes, a fraction of a second later.
    const {relief} = knifeRelief(map, size, this.strokeSize)
    material.addEventListener('dispose', () => relief.dispose())
    const load = texture(relief).r
    // The paint stands 13 mm at its thickest and 2 mm more where the picture is light, sloped by the relief’s texels and the picture’s pixels.
    const art = map.image as HTMLCanvasElement
    const paintSlope = textureSlope(at => texture(relief, at).r, vec2(1 / relief.image.width, 1 / relief.image.height))
    const toneSlope = textureSlope(at => luminance(texture(map, at).rgb), vec2(1 / art.width, 1 / art.height))
    material.colorNode = image.mul(load.mul(0.18).sub(0.1).mul(this.depth).add(1))
    material.normalNode = slopeNormal(paintSlope.mul(0.013).add(toneSlope.mul(0.002)).mul(uvPerMeter).mul(this.depth))
    material.roughnessNode = mix(float(0.71), float(0.19), load.mul(this.gloss))
    material.clearcoat = this.gloss * 0.22
    material.clearcoatRoughness = 0.43
  }
}
