import type {FoilSurface} from '../base/FoilCanvasMaterial.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {float, mix, uv, vec2, vec3} from 'three/tsl'

import {insideBy} from '#src/lib/materials/filters.ts'

import FoilCanvasMaterial from '../base/FoilCanvasMaterial.ts'
import {millimeters} from '../lib/influence.ts'

/** how many meters half a groove is wide at scale 1 for each unit of its width setting, as it was tuned where the plates climb 7.8 per meter, typical of the pictures */
const cutScale = 0.0171
/** how much of the space between two cuts a groove takes at most, where they crowd too closely for its full width */
const crowded = 0.2

/** Three engraved plates: the grooves follow level sets of the individual color channels, catching the light across the local slope. */
export default class IntaglioRareCanvasMaterial extends FoilCanvasMaterial {
  readonly cut = 0.2
  override readonly description = 'Intaglio rare: three foil cuts trace changes in red, green and blue, gathering around painted edges while even patches stay uncut.'
  readonly resist = 0.8
  override readonly scale = 0.4
  override readonly strength = 0.6
  override readonly title = 'Intaglio rare'

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'angle',
        description: 'the half vector picks the grooves that glint by the way they face, and tints them',
      },
      {
        base: 'distance',
        description: `ink averaged over ${millimeters(this.scale * 0.013)} or a pixel, whichever is wider; grooves fade where they crowd within a pixel`,
      },
      this.keyLight,
      {
        base: 'texture',
        description: 'R, G and B: each plate is cut along steps of its channel, little where that channel is dark',
      },
    ]
  }

  protected override coat(material: MeshPhysicalNodeMaterial, surface: FoilSurface) {
    const {half, uvPerMeter} = surface
    const span = this.scale * 0.013
    const dx = vec2(uvPerMeter.x.mul(span), 0)
    const dy = vec2(0, uvPerMeter.y.mul(span))
    const sample = (at: Node<'vec2'>) => this.ink(surface, at, span)
    const ink = sample(uv())
    const gx = sample(uv().add(dx)).sub(sample(uv().sub(dx)))
    const gy = sample(uv().add(dy)).sub(sample(uv().sub(dy)))
    const plate = (channel: 'b' | 'g' | 'r', register: number, cast: Node<'vec3'>) => {
      const phase = ink[channel].mul(7.5 / this.scale).add(register)
      const footprint = phase.fwidth()
      const gradient = vec2(gx[channel], gy[channel])
      const slope = gradient.length()
      // A groove is as wide in meters wherever it runs, in steps of phase as far as the plate climbs across that width.
      const halfWidth = slope.mul((this.cut * 0.16 + 0.035) * cutScale * 7.5 / (2 * span)).min(crowded)
      const band = insideBy(phase.fract().sub(0.5).abs().sub(halfWidth), footprint).mul(footprint.smoothstep(0.42, 0.87).oneMinus())
      const normal = gradient.div(slope.max(0.001))
      const glint = half.xy.dot(normal).sub(register * 0.47).abs().smoothstep(0.02, 0.4).oneMinus()
      const transfer = mix(float(1), ink[channel].smoothstep(0.1, 0.74), this.resist)
      const mask = band.mul(slope.smoothstep(0.012, 0.12)).mul(transfer).mul(glint.mul(0.82).add(0.18))
      return {
        mask,
        color: mix(cast, this.spectrum(normal.y.mul(0.19).add(register).add(half.x.mul(0.53))), glint.mul(0.56)),
      }
    }
    this.print(material, surface, [plate('r', 0.04, vec3(1, 0.55, 0.31)), plate('g', 0.33, vec3(0.72, 1, 0.82)), plate('b', 0.64, vec3(0.43, 0.62, 1))], 1, 1.75)
  }
}
