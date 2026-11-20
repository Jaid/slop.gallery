import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {float, mix, mx_cell_noise_float, step, vec2, vec3} from 'three/tsl'

import {heightNormal, inside} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** how many mica flakes lie along a meter, each about 2.6 mm across */
const flakes = 380

/** Karakami: overlapping waves, seigaiha, block-printed in mica over the image, which almost vanish head-on and sparkle where they mirror the light. */
export default class KarakamiCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Karakami mica: overlapping seigaiha waves block-printed in mica, nearly invisible head-on and sparkling where they mirror the light.'
  /** how strongly the mica glints, against what it was made with */
  readonly glint = 1
  /** how far its flakes tilt every way, against what they were made with */
  readonly sparkle = 1
  override readonly strength = 0.1
  override readonly title = 'Karakami mica'
  protected override readonly weight = 0.9

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, position}: CanvasSurface) {
    // Rows of circles 5 cm across, a quarter of that apart, every other one shifted by half; each lower row overlaps the one above, so the lowest circle holding a point shows there.
    const cell = position.div(0.05).toVar('karakamiCell')
    const firstRow = cell.y.div(0.25).floor()
    let distance: Node<'float'> = float(9)
    for (const offset of [2, 1, 0, -1, -2]) {
      const row = firstRow.add(offset)
      const shift = row.mod(2).mul(0.5)
      const center = vec2(cell.x.sub(shift).round().add(shift), row.mul(0.25))
      const toCenter = cell.sub(center).length()
      distance = mix(distance, toCenter, step(toCenter, float(0.5)))
    }
    // Four arcs in each circle are printed in mica.
    const arcs = inside(distance.mul(8).fract().sub(0.5).abs().sub(0.16)).toVar('karakamiArcs')
    // Each flake is a facet of its own tilt. Where flakes are too small to resolve, they blur into a rougher glitter.
    const flake = position.mul(flakes)
    const flakeCell = flake.floor()
    const tilt = vec2(mx_cell_noise_float(flakeCell), mx_cell_noise_float(flakeCell.add(17))).sub(0.5)
    const facet = flake.fract().sub(0.5).dot(tilt).div(flakes)
    const resolved = fine(1 / flakes)
    material.colorNode = mix(image, image.mul(0.92).add(vec3(0.05, 0.05, 0.055)), arcs.mul(Math.min(1, this.glint * 0.6)))
    material.normalNode = heightNormal(facet.mul(arcs).mul(resolved).mul(this.sparkle * 0.5))
    material.metalnessNode = arcs.mul(Math.min(1, this.glint * 0.45))
    material.roughnessNode = mix(float(0.7), resolved.oneMinus().mul(this.sparkle * 0.14).add(0.22), arcs.mul(Math.min(1, this.glint)))
    material.iridescenceNode = arcs.mul(Math.min(1, this.glint * 0.25))
  }
}
