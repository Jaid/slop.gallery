import type {PartyOffset} from '../lib/partySite.ts'

/** a snowflake that the blizzard blows out of its origin */
export type BlownFlake = {
  /** where it bursts out toward, as an angle around the origin in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** seconds after the burst that it bursts out */
  delay: number
  /** which of the crystal designs it is, see `snowflake.ts`: 0 a stellar dendrite, 1 a fern star */
  design: number
  /** how fast it falls once the gust has let go of it, in meters a second */
  fall: number
  /** seconds it takes to blow out, whirl and fade away */
  life: number
  /** how far it is blown out into the room, in meters */
  out: number
  /** sets its flutter and its spin apart from the others’ */
  phase: number
  /** how far the gust blows it out from the origin along the wall’s plane, in meters */
  reach: number
  /** its size from the tip of one arm to the tip of the opposite one, in meters */
  size: number
  /** how many turns a second it spins round in the view, its sign the way round */
  spin: number
  /** how far it whirls round the origin, in radians, its sign the way round */
  swirl: number
}

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
/** how big a large crystal is at least, from tip to tip, in meters; every little flake is smaller */
export const largeCrystal = 0.16
/** how many large crystals and how many little flakes burst out */
const crystals = 18
const flakes = 90
/** the share of the large crystals among the designs: the first more often, as the stellar dendrites are the showiest */
const designs = [0, 1, 0, 0, 1] as const

/**
 * A blizzard bursting out of the origin: a gust of little flakes streaming out all round it for most of a second, whirling round it the way the storm turns while they blow out into the room, then drifting down and fading away, and among them, a little after the first, large snow crystals of every design, spinning slowly as they sail out and glittering.
 */
export const blownFlakes: ReadonlyArray<BlownFlake> = [
  ...Array.from({length: flakes}, (_, index) => ({
    delay: 0.03 + (index / flakes) ** 1.4 * 0.6 + sequence(index, 0.13) * 0.06,
    life: 1.7 + sequence(index * 3, 0.41) * 1.1,
    angle: index * Math.PI * (3 - Math.sqrt(5)),
    reach: 0.6 + sequence(index * 5, 0.77) * 1.2,
    out: 0.3 + sequence(index * 7, 0.19) * 1.6,
    swirl: 1.2 + sequence(index * 11, 0.53) * 1.4,
    fall: 0.15 + sequence(index * 13, 0.31) * 0.2,
    size: 0.05 + sequence(index * 17, 0.67) ** 2 * 0.07,
    spin: (sequence(index * 19, 0.29) < 0.5 ? 1 : -1) * (0.3 + sequence(index * 23, 0.61)),
    design: index % 2,
    phase: sequence(index * 29, 0.07) * Math.PI * 2,
  })),
  ...Array.from({length: crystals}, (_, index) => ({
    delay: 0.1 + index / crystals * 0.5 + sequence(index, 0.83) * 0.05,
    life: 2.4 + sequence(index * 3, 0.27) * 0.9,
    angle: index * Math.PI * (3 - Math.sqrt(5)) + 0.4,
    reach: 0.55 + sequence(index * 5, 0.11) * 0.75,
    out: 0.35 + sequence(index * 7, 0.59) * 1,
    swirl: 0.9 + sequence(index * 11, 0.37) * 0.9,
    fall: 0.08 + sequence(index * 13, 0.71) * 0.1,
    size: largeCrystal + sequence(index * 17, 0.23) * 0.12,
    spin: (index % 2 ? 1 : -1) * (0.08 + sequence(index * 19, 0.47) * 0.12),
    design: designs[index % designs.length],
    phase: sequence(index * 29, 0.91) * Math.PI * 2,
  })),
]

/** how far above the floor a flake settles at the lowest, in meters, where it lies until it has faded away */
export const flakeRest = 0.01

/**
 * Where the flake is `seconds` after it burst out, over a floor `floor` meters below the origin (negative): it shoots out from the origin and slows down at once, whirls round it the way the storm turns while it blows out into the room, and sinks ever faster toward the end, fluttering from side to side as it goes, until it settles on the floor.
 * `BlowingSnow` flies them the same way on the GPU.
 */
export function flakeOffset({angle, fall, out, phase, reach, swirl}: BlownFlake, seconds: number, floor = -Infinity): PartyOffset {
  const since = Math.max(0, seconds)
  const distance = reach * (1 - Math.exp(-2.6 * since))
  const around = angle + swirl * (1 - Math.exp(-1.1 * since))
  const flutter = Math.sin(since * 3.1 + phase) * 0.06 * (1 - Math.exp(-2 * since))
  const up = Math.sin(around) * distance - fall * since ** 1.4
  return [Math.cos(around) * distance + flutter, Math.max(floor + flakeRest, up), out * (1 - Math.exp(-1.6 * since)) + 0.05]
}
