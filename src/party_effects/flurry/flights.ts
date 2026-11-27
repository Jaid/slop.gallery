import type {PartyOffset} from '../lib/partySite.ts'

/** a snowflake that bursts out of its origin */
export type Snowflake = {
  /** where it bursts out toward, as an angle around the origin in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** seconds after the burst that it comes out */
  delay: number
  /** how fast it sinks once the wind lets go of it, in m/s, its terminal speed, which it settles to within a third of a second */
  fall: number
  /** how many times a second it flutters side to side as it falls */
  flutter: number
  /** seconds it takes to swirl out, sink, land and melt away */
  life: number
  /** how far it drifts out into the room, in meters */
  out: number
  /** sets its flutter, spin and glint apart from the others’ */
  phase: number
  /** how far it bursts out from the origin along the wall’s plane, in meters */
  reach: number
  /** how wide it is drawn, in meters; every ninth flake is a great stellar one, the rest fine snow */
  size: number
  /** how fast it turns over as it falls, in radians a second, its sign the way round */
  spin: number
  /** how far the gust whirls it around the origin, in radians, its sign the way round */
  swirl: number
}

/** how the flakes fly, which `SwirlingSnow` follows on the GPU term for term: how sharply the burst slows, how fast the drift out into the room settles, how quickly a falling flake reaches its sinking speed (each 1/s), how far the burst keeps drifting outward a second and how wide a flake flutters, across its path and up and down */
export const snowFlight = {
  burst: 2.6,
  drift: 0.1,
  flutterAcross: 0.06,
  flutterUp: 0.025,
  out: 1.6,
  settle: 3,
} as const
const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
/** how many flakes burst out */
const count = 126

/** A flurry bursting out of the origin in a swirling gust: fine snow and, among it, great stellar flakes, streaming out for a second, whirled around the origin most of them the same way while they drift into the room, then fluttering down, landing on the floor and melting away. */
export const snowflakes: ReadonlyArray<Snowflake> = Array.from({length: count}, (_, index) => {
  const great = index % 9 === 4
  return {
    delay: 0.04 + index / count * 0.95 + sequence(index, 0.41) * 0.08,
    life: 2.7 + sequence(index * 3, 0.13) * 1.3,
    angle: index * Math.PI * (3 - Math.sqrt(5)),
    reach: 0.5 + sequence(index * 5, 0.57) * 1.05,
    out: 0.45 + sequence(index * 7, 0.31) * 1.5,
    swirl: (sequence(index * 11, 0.79) < 0.78 ? 1 : -1) * (0.8 + sequence(index * 13, 0.67) * 1.3),
    fall: 0.38 + sequence(index * 17, 0.09) * 0.38,
    size: great ? 0.125 + sequence(index * 19, 0.43) * 0.055 : 0.035 + sequence(index * 19, 0.43) * 0.045,
    flutter: 1.4 + sequence(index * 23, 0.23) * 2.2,
    spin: (sequence(index * 29, 0.71) - 0.5) * 5,
    phase: sequence(index * 31, 0.17) * Math.PI * 2,
  }
})

/**
 * Where the flake is `seconds` after it came out, over a floor `floor` meters below its origin (negative): it bursts out and slows at once, whirled around the origin while it drifts into the room, settles to its sinking speed fluttering side to side, and rests on the floor once it lands.
 * `SwirlingSnow` flies them the same way on the GPU.
 */
export function flakeOffset({angle, fall, flutter, out, phase, reach, size, swirl}: Snowflake, seconds: number, floor: number): PartyOffset {
  const since = Math.max(0, seconds)
  const {burst, drift, flutterAcross, flutterUp, out: outRate, settle} = snowFlight
  const distance = reach * (1 - Math.exp(-burst * since)) + drift * since
  const around = angle + swirl * (1 - Math.exp(-0.7 * since))
  // The distance sunk while its speed settles exponentially to its terminal one.
  const fallen = fall * (since - (1 - Math.exp(-settle * since)) / settle)
  const fluttering = Math.min(1, since)
  const across = Math.sin(since * flutter * Math.PI * 2 + phase) * flutterAcross * fluttering
  const along = Math.cos(around) * distance - Math.sin(around) * across
  const up = Math.sin(around) * distance + Math.cos(around) * across - fallen + Math.sin(since * flutter * 1.31 * Math.PI * 2 + phase * 1.7) * flutterUp * fluttering
  return [along, Math.max(up, floor + size * 0.5), out * (1 - Math.exp(-outRate * since)) + 0.05]
}
