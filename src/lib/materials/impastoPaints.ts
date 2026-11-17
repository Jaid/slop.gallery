import type {Node} from 'three/webgpu'

import {swatch} from './oilPaints.ts'

/** the heavy-bodied paints the Impasto Orb is sculpted from, which its knife smears are slapped on in and its frame is buried under: a dusk over the sea, warm lights against deep cool shadows */
export const impastoPaints = {
  naplesYellow: '#f1c75b',
  cadmiumOrange: '#e8641e',
  alizarinCrimson: '#9c1630',
  prussianBlue: '#163a66',
  cobaltTeal: '#1c9a96',
  titaniumWhite: '#f4efe2',
} as const
export type ImpastoPaint = keyof typeof impastoPaints

/** the Impasto Orb’s paints in the order its smears and its frame name them by, as an index into this */
export const impastoOrder = ['naplesYellow', 'cadmiumOrange', 'alizarinCrimson', 'prussianBlue', 'cobaltTeal', 'titaniumWhite'] as const satisfies ReadonlyArray<ImpastoPaint>

/** The index of `paint` in {@link impastoOrder}. */
export function impastoIndex(paint: ImpastoPaint) {
  return impastoOrder.indexOf(paint)
}

/** The color of the paint at `index` of {@link impastoOrder}. */
export function impastoColor(index: Node<'float'>) {
  return swatch(impastoOrder.map(paint => impastoPaints[paint]), index)
}
