import type {Node} from 'three/webgpu'

import hsl from 'okhsl'

import {swatch} from './oilPaints.ts'

/** the palette shared by the Impasto frame, its knife smears and the Paint Orb’s rosette */
export const impastoPaints = {
  naplesYellow: hsl.integer(88, 81, 82),
  cadmiumOrange: hsl.integer(44, 94, 60.4),
  alizarinCrimson: hsl.integer(17, 91, 36),
  prussianBlue: hsl.integer(255, 71, 25),
  cobaltTeal: hsl.integer(191, 90, 56),
  titaniumWhite: hsl.integer(89, 39, 94.5),
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
