import type {PartyOffset} from '../lib/partySite.ts'

/** a ghost that escapes its origin */
export type EscapingGhost = {
  /** where it shoots out toward, as an angle around the origin in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** how far its tail curls to the side while it is smeared out of the origin, in widths of its head, its sign the side */
  curl: number
  /** seconds after the burst that it escapes */
  delay: number
  /** seconds it takes to rise and fade away */
  life: number
  /** sets its animation apart from the others’ */
  phase: number
  /** the pitch its wail sets out from, in hertz */
  pitch: number
  /** how far it shoots out toward its angle, in meters */
  reach: number
  /** how high it rises on top of that, in meters */
  rise: number
  /** how wide it is drawn, in meters; its head is about 0.4 of that */
  size: number
}

const degrees = Math.PI / 180

/** Three ghosts escaping in quick succession right after the burst, fanning out to the left, straight up and to the right, wailing a dissonant chord. */
export const escapingGhosts: ReadonlyArray<EscapingGhost> = [{
  delay: 0.22,
  life: 1.7,
  angle: 148 * degrees,
  reach: 1.35,
  rise: 1.3,
  size: 0.95,
  curl: 0.55,
  phase: 0,
  pitch: 440,
}, {
  delay: 0.3,
  life: 1.9,
  angle: 90 * degrees,
  reach: 1.4,
  rise: 1.5,
  size: 1,
  curl: -0.4,
  phase: 2.3,
  pitch: 523.25,
}, {
  delay: 0.38,
  life: 1.6,
  angle: 30 * degrees,
  reach: 1.35,
  rise: 1.2,
  size: 0.85,
  curl: -0.6,
  phase: 4.1,
  pitch: 392,
}]

/**
 * Where the middle of the ghost’s head is `seconds` after it escaped: it shoots out toward its angle, to the side and up and a little into the room, slows down at once and rises ever faster.
 * `EscapingGhosts` flies them the same way on the GPU.
 */
export function ghostOffset({angle, life, reach, rise}: EscapingGhost, seconds: number): PartyOffset {
  const since = Math.max(0, seconds)
  const progress = Math.min(1, since / life)
  // toward its angle and 0.3 of that into the room, as one unit
  const distance = reach * (1 - Math.exp(-4 * since)) / Math.hypot(1, 0.3)
  return [Math.cos(angle) * distance, Math.sin(angle) * distance + rise * progress ** 1.5, 0.3 * distance]
}
