import type FatedRandom from 'fated-random'
import type {RollOptions} from 'fated-random'

/** the steps the Studio’s values go by, both in what other seeds roll and on the world tuning’s sliders, so the sliders reach every value a seed rolls */
export const studioSteps = {
  /** the room’s width, depth and height, in meters */
  size: 1,
  /** where the moon or sun stands, in degrees */
  lightAngle: 1,
  lightStrength: 0.1,
  lightShafts: 0.05,
  /** a factor on the graphics mode’s */
  lightBlur: 0.5,
  /** in candela */
  lampStrength: 5,
  lampDecay: 0.05,
  /** where the primary lamp hangs and how high either does, in meters */
  lampPlace: 0.05,
  /** where the secondary lamp hangs, as a share of the room’s width, depth or height */
  lampShare: 0.005,
  /** how far a lamp reaches, in meters */
  lampRange: 0.5,
  /** in degrees */
  lampBlur: 0.5,
  fill: 0.01,
  mirror: 0.05,
  /** in pixels of a 1080-row image */
  mirrorBlur: 0.5,
} as const satisfies Record<string, number>

/** The multiple of `step` nearest to the value; a step that divides 1 divides instead of multiplying, which keeps off float noise like 0.45000000000000007 for nine steps of 0.05. */
export function onStep(value: number, step: number) {
  const perUnit = Math.round(1 / step)
  // Adding 0 turns the −0 of a small negative value into 0.
  return (perUnit > 1 && Math.abs(perUnit * step - 1) < 1e-9 ? Math.round(value * perUnit) / perUnit : Math.round(value / step) * step) + 0
}

/** A multiple of `step` from `min` to `max`, both included, as `random` rolls it, every one of them as likely as the others unless `easing` favors some; bounds off the steps round to the nearest step within them. */
export function rollOnStep(random: FatedRandom, [min, max]: readonly [min: number, max: number], step: number, options?: RollOptions) {
  return onStep(random.rollInteger(Math.ceil(onStep(min / step, 1e-9)), Math.floor(onStep(max / step, 1e-9)), options) * step, step)
}
