import type {PartyOffset} from '../lib/partySite.ts'

/** an eye that opens in the air around the origin as it bursts */
export type StaringEye = {
  /** seconds after the burst that it shuts */
  close: number
  /** seconds after the burst that it opens */
  open: number
  /** sets its darting, blinking and the wrinkles around it apart from the others’, 0–1 */
  phase: number
  /** how wide it is, in meters */
  size: number
  /** whether its pupil is a slit, like a cat’s */
  slit: boolean
  /** where it opens */
  spot: PartyOffset
  /** whether it weeps blood once it stares */
  weeps: boolean
}

/** seconds after the burst that every eye snaps round to stare at whoever watches */
export const staring = 0.85
/** seconds an eye takes to open */
export const opening = 0.28
/** seconds an eye takes to shut, and then for what is left of it to fade away */
export const shutting = {
  lids: 0.1,
  fading: 0.35,
} as const
const degrees = Math.PI / 180
/** where an eye opens: an angle around the origin in the wall’s plane and how far out from it, and how far out the way the site faces */
const spot = (angle: number, distance: number, out: number): PartyOffset => [Math.cos(angle * degrees) * distance, Math.sin(angle * degrees) * distance, out]

/** Eleven eyes of every size opening in the dark round the origin one after another, the nearest first, all clear of its middle, where a fusion’s result flies out, darting about until they all snap round at once to stare at whoever watches, three of them weeping blood, until they slam shut one after another and are gone. */
export const staringEyes: ReadonlyArray<StaringEye> = ([
  [spot(150, 0.95, 0.25), 0.5, 0.05, 2.1, 'weeps'],
  [spot(205, 1.05, 0.2), 0.4, 0.12, 2.35, 'slit'],
  [spot(30, 1, 0.3), 0.54, 0.08, 2.2, 'weeps'],
  [spot(-25, 1.15, 0.2), 0.38, 0.18, 2.45],
  [spot(245, 0.85, 0.35), 0.34, 0.24, 2.15],
  [spot(300, 0.9, 0.3), 0.44, 0.28, 2.3, 'weeps'],
  [spot(122, 1.45, 0.15), 0.3, 0.36, 2.5],
  [spot(58, 1.45, 0.2), 0.34, 0.4, 2.25, 'slit'],
  [spot(178, 1.6, 0.1), 0.28, 0.47, 2.6],
  [spot(2, 1.6, 0.12), 0.3, 0.52, 2.4],
  [spot(272, 1.3, 0.45), 0.26, 0.58, 2.55, 'slit'],
] satisfies Array<[PartyOffset, number, number, number, ('slit' | 'weeps')?]>).map(([eyeSpot, size, open, close, trait], index) => ({
  spot: eyeSpot,
  size,
  open,
  close,
  weeps: trait === 'weeps',
  slit: trait === 'slit',
  phase: index * 0.618 % 1,
}))
