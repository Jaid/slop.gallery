import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {mx_noise_float, vec3} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

const tau = 2 * Math.PI

/** Abalone shell under translucent ink: bands of nacre show through, sea green turning violet along their growth lines as the work turns. */
export default class NacreCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Abalone ground: translucent ink over shell, whose growth bands turn from sea green to violet as the work turns.'
  /** how strongly the shell’s color shifts with the view, against what it was made with */
  readonly play = 1
  override readonly scale = 0.5
  /** how much of the shell shows through the ink, against what it was made with */
  readonly shell = 1
  override readonly strength = 0.1
  override readonly title = 'Abalone ground'

  protected override paint(material: MeshPhysicalNodeMaterial, {image, luminance, position, view}: CanvasSurface) {
    const growth = position.y.mul(6.3).add(position.x.mul(2.3)).add(mx_noise_float(position.mul(3.8)).mul(2.5)).add(mx_noise_float(position.mul(16)).mul(0.16)).toVar('nacreGrowth')
    const rings = growth.mul(tau).sin().mul(0.5).add(0.5)
    const lamellae = growth.mul(tau * 6).sin().mul(0.5).add(0.5)
    const pearl = vec3(0.9, 2.99, 4.65).add(growth.mul(1.6)).add(view.x.mul(6.3).add(view.y.mul(2.7)).mul(this.play)).cos().mul(0.38).add(0.62)
    // The shell shows most through the dark ink.
    const showing = rings.mul(0.18).add(0.13).mul(luminance.sqrt().oneMinus().mul(0.48).add(0.52)).mul(this.shell)
    material.colorNode = image.mul(1 - this.shell * 0.12).add(pearl.mul(showing).mul(lamellae.mul(0.22).add(0.78)))
    material.normalNode = heightNormal(rings.mul(0.0026).add(lamellae.mul(0.00055)).mul(this.shell))
    material.roughness = 0.29
    material.metalness = 0.26
    material.iridescence = Math.min(1, this.play * 0.7)
    material.iridescenceThicknessNode = rings.mul(260).add(230)
    material.clearcoat = 0.26
    material.clearcoatRoughness = 0.28
  }
}
