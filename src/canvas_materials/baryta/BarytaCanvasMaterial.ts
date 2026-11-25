import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import hsl from 'okhsl'
import {mx_noise_float} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** Satin baryta photographic paper: the print keeps its colors under a finely pebbled satin surface, over which a soft silver glint breaks, most of all in the dark ink. */
export default class BarytaCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Satin baryta: a photographic print under a finely pebbled satin surface with a soft silver glint in its dark ink.'
  /** how strongly the silver glints, against what it was made with */
  readonly glint = 1
  /** how deep the satin’s pebbling is, against what it was made with */
  readonly pebble = 1
  override readonly scale = 0.5
  override readonly strength = 0.5
  override readonly title = 'Satin baryta'
  protected override readonly weight = 0.55

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, luminance, position}: CanvasSurface) {
    const pebbling = mx_noise_float(position.mul(196)).mul(0.64).add(mx_noise_float(position.mul(307)).mul(0.36)).mul(fine(0.006))
    material.normalNode = heightNormal(pebbling.mul(this.pebble * 0.00052))
    material.roughnessNode = pebbling.mul(0.12).add(0.38)
    // Silver shows in the dark ink, where the print holds most of it.
    material.metalnessNode = luminance.sqrt().oneMinus().mul(this.glint * 0.13).min(1)
    material.sheen = this.glint * 0.34
    material.sheenColor.set(hsl.integer(232, 17, 92))
    material.sheenRoughness = 0.52
    material.clearcoat = 0.28
    material.clearcoatRoughness = 0.38
  }
}
