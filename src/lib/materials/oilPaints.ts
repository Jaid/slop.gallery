import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {select} from 'three/tsl'

import {rgb} from '#src/orbs/lib/fill.ts'

/** the oil paints of the Paint Orb’s effects, each from a tube of its own, which its brush strokes are laid in and the painters’ frames are daubed with */
export const oilPaints = {
  cadmiumYellow: hsl.integer(85, 99.4, 78),
  vermilion: hsl.integer(31, 94.6, 51),
  titaniumWhite: hsl.integer(89, 39, 94.5),
  ultramarine: hsl.integer(267, 91, 31.6),
  viridian: hsl.integer(168, 96, 44),
} as const
export type OilPaint = keyof typeof oilPaints

/** the Paint Orb’s paints in the order its strokes name them by, as an index into this */
export const paintOrder = ['cadmiumYellow', 'vermilion', 'titaniumWhite', 'ultramarine', 'viridian'] as const satisfies ReadonlyArray<OilPaint>

/** The color at `index` of `colors`, an index picked on the GPU, like a paint by the number of its tube; indices below the first or past the last take the first or the last. */
export function swatch(colors: ReadonlyArray<number>, index: Node<'float'>) {
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
