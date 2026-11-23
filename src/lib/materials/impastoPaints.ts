import type {Node} from 'three/webgpu'

import {swatch} from './oilPaints.ts'

/** the palette shared by the Impasto frame, its knife smears and the Paint Orb’s rosette */
export const impastoPaints = {
  naplesYellow: '#f1c75b',
  cadmiumOrange: '#e8641e',
  alizarinCrimson: '#9c1630',
  prussianBlue: '#163a66',
  cobaltTeal: '#1c9a96',
  titaniumWhite: '#f4efe2',
} as const
export type ImpastoPaint = keyof typeof impastoPaints

/** pigment order in the frame and smear shaders */
export const impastoOrder = ['naplesYellow', 'cadmiumOrange', 'alizarinCrimson', 'prussianBlue', 'cobaltTeal', 'titaniumWhite'] as const satisfies ReadonlyArray<ImpastoPaint>

export function impastoIndex(paint: ImpastoPaint) {
  return impastoOrder.indexOf(paint)
}

/** The color of the paint at `index` of {@link impastoOrder}. */
export function impastoColor(index: Node<'float'>) {
  return swatch(impastoOrder.map(paint => impastoPaints[paint]), index)
}
