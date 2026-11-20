import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {float, mix, texture} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

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

  protected override paint(material: MeshPhysicalNodeMaterial, {image, luminance, map}: CanvasSurface) {
    // Flat until a worker has laid the strokes, a fraction of a second later.
    const {relief} = knifeRelief(map, this.strokeSize)
    material.addEventListener('dispose', () => relief.dispose())
    const load = texture(relief).r
    material.colorNode = image.mul(load.mul(0.18).sub(0.1).mul(this.depth).add(1))
    material.normalNode = heightNormal(load.mul(0.013).add(luminance.mul(0.002)).mul(this.depth))
    material.roughnessNode = mix(float(0.71), float(0.19), load.mul(this.gloss))
    material.clearcoat = this.gloss * 0.22
    material.clearcoatRoughness = 0.43
  }
}
