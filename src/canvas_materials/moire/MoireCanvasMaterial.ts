import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {mx_noise_float, vec2} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

const tau = 2 * Math.PI

/** Watered silk, moiré faille: fine ribs pressed into a watermark like wood grain, whose light and dark waves trade places as the light or the view moves. */
export default class MoireCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Watered silk: fine horizontal ribs pressed into a watermark like wood grain, whose light and dark waves trade places as the light moves.'
  override readonly scale = 0.8
  /** how strongly the silk catches grazing light */
  readonly sheen = 0.45
  override readonly strength = 0.02
  override readonly title = 'Watered silk'
  /** how strongly the watermark is pressed in, against what it was made with */
  readonly water = 1.2
  protected override readonly weight = 0.75

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, position}: CanvasSurface) {
    // The watermark crushes the ribs unevenly: one wave tilts them up, the next down, so the waves swap brightness with the light.
    const wave = position.y.mul(26).add(mx_noise_float(position.mul(vec2(2.2, 5.5))).mul(3.4)).add(mx_noise_float(position.mul(vec2(7, 15))).mul(0.5))
    const pressed = wave.mul(tau).sin().mul(this.water).toVar('moirePressed')
    // 620 ribs per meter.
    const ribPhase = position.y.mul(620).add(pressed.mul(0.22))
    const rib = ribPhase.mul(tau).sin().add(ribPhase.mul(tau * 2).sin().mul(pressed).mul(0.45))
    material.colorNode = image.mul(pressed.mul(0.035).add(1))
    material.normalNode = heightNormal(rib.mul(fine(1 / 620)).mul(0.00018).add(pressed.mul(0.0006)))
    material.roughnessNode = pressed.mul(0.08).add(0.36)
    material.sheen = this.sheen
    material.sheenColor.set('#f3eee6')
    material.sheenRoughness = 0.3
  }
}
