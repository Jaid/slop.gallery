import type {SteelTable} from './steelTable.ts'
import type {BufferGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {place, roundedBox} from './lodgeInterior/place.ts'
import {steelStretcher} from './steelTable.ts'

/**
 * A steel workshop table, see {@link SteelTable}: one thick slab with eased edges for a top, over rails round its sides and ends, on square legs set in from the top’s edges and tied together by a stretcher along each side.
 * The origin is on the floor under its middle. Its `top` and its iron `frame` are pieces of their own, for their two materials.
 */
export default class SteelTableGeometry {
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor({apron: [apronDepth, apronThickness], height, leg, legs, legX, length, overhang, top, width}: SteelTable) {
    this.top = place(roundedBox([width, top, length], 0.006), 0, height - top / 2, 0)
    const underTop = height - top
    const apronY = underTop - apronDepth / 2
    const parts: Array<BufferGeometry> = []
    // The rails along both sides and across both ends, their faces where the top’s overhang ends
    for (const side of [-1, 1]) {
      parts.push(
        place(roundedBox([apronThickness, apronDepth, length - overhang * 2], 0.004, 2), side * (width / 2 - overhang - apronThickness / 2), apronY, 0),
        place(roundedBox([width - overhang * 2 - apronThickness * 2, apronDepth, apronThickness], 0.004, 2), 0, apronY, side * (length / 2 - overhang - apronThickness / 2)),
      )
    }
    for (const z of legs) {
      for (const side of [-1, 1]) {
        parts.push(place(roundedBox([leg, underTop, leg], 0.004, 2), side * legX, underTop / 2, z))
      }
    }
    // A stretcher along each side, between the legs at its ends
    const span = legs.at(-1)! - legs[0] + leg
    for (const side of [-1, 1]) {
      parts.push(place(roundedBox([steelStretcher.thickness, steelStretcher.height, span], 0.004, 2), side * legX, steelStretcher.y, 0))
    }
    this.frame = mergeParts(parts)
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
