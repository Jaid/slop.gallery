import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {float, luminance, mx_cell_noise_float, mx_noise_float, texture, uv, vec2} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

const pitch = 0.028
const tau = 2 * Math.PI

/** Bundles of embroidery silk tangent to the picture’s edges, with a slowly turning fill stitch in flat areas. */
export default class SatinStitchCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Satin stitch: embroidered silk follows the local edges of the picture, differently sewn patches taking turns in the light.'
  /** thread height against the authored stitch; at zero its color and luster alone show */
  readonly loft: number = 0
  readonly luster = 0.2
  override readonly scale = 0.4
  override readonly strength = 0.9
  override readonly title = 'Satin stitch'

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, map, position, uvPerMeter}: CanvasSurface) {
    const grid = position.div(pitch)
    const patch = grid.floor()
    const local = grid.fract()
    const texel = uvPerMeter.mul(this.scale * pitch * 0.45)
    const dx = vec2(texel.x, 0)
    const dy = vec2(0, texel.y)
    const tone = (offset: Node<'vec2'>) => luminance(texture(map, uv().add(offset).clamp()).grad(dx, dy).rgb).sqrt()
    const gradient = vec2(tone(dx).sub(tone(dx.negate())), tone(dy).sub(tone(dy.negate())))
    const fill = mx_noise_float(grid.mul(0.16)).mul(2).add(0.55)
    const tangent = vec2(gradient.y.negate(), gradient.x).add(vec2(fill.cos(), fill.sin()).mul(0.032))
    const axis = tangent.div(tangent.length().max(0.0001)).toVar('satinAxis')
    const across = vec2(axis.y.negate(), axis.x)
    const fade = local.smoothstep(0, 1)
    // Overlap four bundles so the threads can turn without showing the square lattice they were laid from.
    let relief: Node<'float'> = float(0)
    for (const x of [0, 1]) {
      for (const y of [0, 1]) {
        const offset = vec2(x, y)
        const delta = local.sub(offset)
        const phase = mx_cell_noise_float(patch.add(offset))
        const rib = delta.dot(across).mul(5).add(phase).mul(tau).cos().mul(0.5).add(0.5)
        const tip = delta.dot(axis).add(phase).mul(Math.PI).cos().abs().smoothstep(0.07, 0.48)
        const blend = (x ? fade.x : fade.x.oneMinus()).mul(y ? fade.y : fade.y.oneMinus())
        relief = relief.add(rib.mul(tip.mul(0.65).add(0.35)).mul(blend))
      }
    }
    const thread = relief.mul(fine(pitch / 5)).toVar('satinThread')
    material.colorNode = image.mul(thread.mul(0.2).add(0.92))
    if (this.loft) {
      material.normalNode = heightNormal(thread.mul(0.0018 * this.loft * this.scale))
    }
    material.anisotropyNode = axis.mul(this.luster * 0.95)
    material.roughness = 0.77 - this.luster * 0.43
    material.sheenNode = image.mul(0.65).add(0.25).mul(this.luster)
    material.sheenRoughness = 0.38
  }
}
