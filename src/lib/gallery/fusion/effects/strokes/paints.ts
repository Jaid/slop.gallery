import type {OilPaint} from '#src/lib/materials/oilPaints.ts'
import type {Node} from 'three/webgpu'

import {select} from 'three/tsl'

import {oilPaints} from '#src/lib/materials/oilPaints.ts'
import {rgb} from '#src/lib/materials/orb/fill.ts'

/** the Paint Orb’s paints in the order its strokes name them by, as an index into this */
export const paintOrder = ['cadmiumYellow', 'vermilion', 'titaniumWhite', 'ultramarine', 'viridian'] as const satisfies ReadonlyArray<OilPaint>

/** The index of `paint` in {@link paintOrder}. */
export function paintIndex(paint: OilPaint) {
  return paintOrder.indexOf(paint)
}

/** The color of the paint at `index` of {@link paintOrder}. */
export function paintColor(index: Node<'float'>) {
  let color: Node<'vec3'> = rgb(oilPaints[paintOrder[0]])
  for (const [order, paint] of paintOrder.entries()) {
    if (order) {
      color = select(index.greaterThan(order - 0.5), rgb(oilPaints[paint]), color)
    }
  }
  return color
}
