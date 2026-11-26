import type {FoilSurface} from '../base/FoilCanvasMaterial.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {mix, uv, vec2, vec3} from 'three/tsl'

import FoilCanvasMaterial from '../base/FoilCanvasMaterial.ts'

/** Three gratings exposed through the separations: an ink’s density determines where in the sweep its color catches. */
export default class PrismSweepCanvasMaterial extends FoilCanvasMaterial {
  override readonly description = 'Prism sweep: red, green and blue expose their own diffraction gratings, so different parts of the print flash at different angles.'
  readonly dispersion = 0.9
  override readonly scale = 2
  override readonly strength = 0.5
  override readonly title = 'Prism sweep'
  readonly width = 0.5

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'angle',
        description: 'the half vector between the view and the key light rakes each sweep across the print and shifts its hue',
      },
      {
        base: 'distance',
        description: 'ink averaged over 5 mm or a pixel, whichever is wider',
      },
      this.keyLight,
      {
        base: 'texture',
        description: 'R, G and B: each channel’s density sets where in the sweep its color catches',
      },
    ]
  }

  protected override coat(material: MeshPhysicalNodeMaterial, surface: FoilSurface) {
    const {half, position} = surface
    const ink = this.ink(surface, uv(), 0.005)
    const axis = vec2(0.85, 0.52)
    const rake = position.dot(axis).mul(0.35).sub(half.xy.dot(axis).mul(1.62))
    const plate = (value: Node<'float'>, other: Node<'float'>, phase: number) => {
      const along = rake.add(value.mul(0.92)).sub(other.sub(value).mul(0.24)).add(phase * 0.13).fract().sub(0.5).div(this.width * 0.26 + 0.045)
      const band = along.abs().smoothstep(0.1, 1).oneMinus()
      const color = this.spectrum(along.mul(this.dispersion * 0.25).add(phase).add(half.y.mul(0.3)))
      return {
        mask: band.mul(value.mul(0.85).add(0.15)),
        color: mix(vec3(0.9, 0.94, 1), color, this.dispersion),
      }
    }
    this.print(material, surface, [plate(ink.r, ink.g, 0.02), plate(ink.g, ink.b, 0.35), plate(ink.b, ink.r, 0.68)], 0.93, 1.65)
  }
}
