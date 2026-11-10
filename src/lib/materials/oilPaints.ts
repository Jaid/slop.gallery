import type {Node} from 'three/webgpu'

import {select} from 'three/tsl'

import {rgb} from '#src/orbs/lib/fill.ts'

/** the oil paints the Paint Orb holds, each from a tube of its own, which its ribbons curl in, its effects are laid in and the painters’ frames are daubed with */
export const oilPaints = {
  cadmiumYellow: '#f2b705',
  vermilion: '#d8341e',
  titaniumWhite: '#f4efe2',
  ultramarine: '#1f3aa8',
  viridian: '#0f7a5c',
} as const
export type OilPaint = keyof typeof oilPaints

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
