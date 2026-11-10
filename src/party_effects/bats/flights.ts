import type {PartyOffset} from '../lib/partySite.ts'

/** a bat that bursts out of its origin */
export type FlyingBat = {
  /** where it bursts out toward, as an angle around the origin in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** how many times a second it beats its wings */
  beat: number
  /** seconds after the burst that it bursts out */
  delay: number
  /** seconds it takes to circle the origin, fly off and fade away */
  life: number
  /** how far it flies out into the room, in meters */
  out: number
  /** sets its wingbeat and wobble apart from the others’ */
  phase: number
  /** how far it swings out from the origin along the wall’s plane, in meters */
  reach: number
  /** how high it climbs on top of that while it flies off, in meters */
  rise: number
  /** its wingspan, in meters */
  size: number
  /** how far it circles around the origin, in radians, its sign the way round */
  swirl: number
}

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
/** how many bats burst out */
const count = 26

/** A swarm of bats streaming out of the origin for half a second, fanning out all round it and whirling around it, most of them the same way, while they fly out into the room, then climbing off and fading away into the dark. */
export const flyingBats: ReadonlyArray<FlyingBat> = Array.from({length: count}, (_, index) => ({
  delay: 0.1 + index / count * 0.45 + sequence(index, 0.37) * 0.06,
  life: 1.9 + sequence(index * 3, 0.11) * 0.7,
  angle: index * Math.PI * (3 - Math.sqrt(5)),
  reach: 0.65 + sequence(index * 5, 0.53) * 0.8,
  out: 0.5 + sequence(index * 7, 0.29) * 1.5,
  swirl: (sequence(index * 11, 0.83) < 0.8 ? 1 : -1) * (1.5 + sequence(index * 13, 0.61) * 1.6),
  rise: 0.9 + sequence(index * 17, 0.07) * 1.3,
  size: 0.24 + sequence(index * 19, 0.47) * 0.16,
  beat: 9 + sequence(index * 23, 0.19) * 5,
  phase: sequence(index * 29, 0.71) * Math.PI * 2,
}))

/**
 * Where the bat is `seconds` after it burst out: it shoots out from the origin and slows down at once, whirls around it while it flies out into the room and climbs ever faster toward the end.
 * `SwarmingBats` flies them the same way on the GPU.
 */
export function batOffset({angle, life, out, reach, rise, swirl}: FlyingBat, seconds: number): PartyOffset {
  const since = Math.max(0, seconds)
  const progress = Math.min(1, since / life)
  const distance = reach * (1 - Math.exp(-3.2 * since)) + 0.25 * since
  const around = angle + swirl * (1 - Math.exp(-0.9 * since))
  return [Math.cos(around) * distance, Math.sin(around) * distance + rise * progress ** 2.2, out * (1 - Math.exp(-1.8 * since)) + 0.05]
}
