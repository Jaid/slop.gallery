import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {mix, step, texture, uv, vec2, vec3} from 'three/tsl'

import {inside} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** Three transparent sheets of subtractive ink, registered head-on and separated by the optical path through their spacers at a slant. */
export default class TrichromeCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Trichrome register: cyan, magenta and yellow halftones on three clear sheets whose color fringes trade sides as the panel turns.'
  readonly gap = 2
  override readonly scale = 0.4
  readonly screen = 0.2
  override readonly strength = 0.7
  override readonly title = 'Trichrome register'

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, map, position, uvPerMeter, view}: CanvasSurface) {
    const ray = view.xy.div(view.z.max(0.45)).mul(this.gap * 0.012 * this.strength)
    const dots = fine(0.0085).mul(this.screen)
    const plate = (channel: 'b' | 'g' | 'r', angle: number, depth: number) => {
      const shift = ray.mul(depth)
      const sample = depth ? texture(map, uv().sub(shift.mul(uvPerMeter)).clamp())[channel] : image[channel]
      const ink = sample.sqrt().oneMinus()
      const screenPosition = (depth ? position.sub(shift.div(this.scale)) : position).div(0.0085)
      const x = Math.cos(angle)
      const y = Math.sin(angle)
      const cell = vec2(screenPosition.dot(vec2(x, y)), screenPosition.dot(vec2(-y, x))).fract().sub(0.5).abs()
      // Inverse area of a diamond on a square grid: dots grow into touching diamonds, then the pinholes between them shrink away.
      const radius = mix(ink.mul(0.5).sqrt(), ink.oneMinus().mul(0.5).sqrt().oneMinus(), step(0.5, ink))
      return mix(ink, inside(cell.x.add(cell.y).sub(radius)), dots).oneMinus()
    }
    const pigment = vec3(plate('r', Math.PI / 12, -1), plate('g', Math.PI * 5 / 12, 0), plate('b', 0, 1)).toVar('trichromePigment')
    material.colorNode = pigment.mul(pigment).mul(0.965).add(vec3(0.021, 0.016, 0.012))
    material.roughness = 0.54
    material.clearcoat = 0.34
    material.clearcoatRoughness = 0.22
  }
}
