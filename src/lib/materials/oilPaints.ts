import type {Node} from 'three/webgpu'

import {select} from 'three/tsl'

import {rgb} from '#src/orbs/lib/fill.ts'

/** the oil paints of the Paint Orb’s effects, each from a tube of its own, which its brush strokes are laid in and the painters’ frames are daubed with */
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

/** The color at `index` of `colors`, an index picked on the GPU, like a paint by the number of its tube; indices below the first or past the last take the first or the last. */
export function swatch(colors: ReadonlyArray<string>, index: Node<'float'>) {
  let color: Node<'vec3'> = rgb(colors[0])
  for (const [order, value] of colors.entries()) {
    if (order) {
      color = select(index.greaterThan(order - 0.5), rgb(value), color)
    }
  }
  return color
}

/** The index of `paint` in {@link paintOrder}. */
export function paintIndex(paint: OilPaint) {
  return paintOrder.indexOf(paint)
}

/** The color of the paint at `index` of {@link paintOrder}. */
export function paintColor(index: Node<'float'>) {
  return swatch(paintOrder.map(paint => oilPaints[paint]), index)
}
