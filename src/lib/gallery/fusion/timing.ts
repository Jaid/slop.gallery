import {clamp} from 'math'

/** how long the parts of a fusion take, in seconds */
export type FusionTiming = {
  /** The portal closes after the result flipped out of it. */
  afterglow: number
  /** The work and what was thrown into it spiral into the portal before the result flips out. */
  climax: number
  /** A failed fusion hands the work back to its wall and spits out what was thrown into it. */
  fizzle: number
  /** After the lull, each of the images surfaces in the portal for this long, one after another, over and over until the outcome is in. */
  image: number
  /** The ceremony opens with this, once and never looped: the portal forms, takes hold of every ingredient and shows each image once, until they orbit it. */
  intro: number
  /** After the intro, the portal brews this long without an image while the ring of silk’s landing dies away, before the images start taking turns, so the first one’s bell doesn’t drown in it. */
  lull: number
  /** A result never shows before this, however fast the image model answers; a failure, from the model or the player breaking the fusion off, only waits for the intro. */
  minimum: number
}

/** how many turns of the images every fusion shows after its lull before its result may show */
export const minimumTurns = 4
/** the pulse the whole fusion keeps, in seconds: the intro’s burst, ignition and landing, every turn of the images and the result flipping out after the climax fall on it */
export const fusionPulse = 1.5
const introDuration = 3 * fusionPulse
const lullDuration = fusionPulse

/** Every part that ends on a peak of its sound lasts whole pulses, so the burst falls on 1.5 s, the landing on 4.5 s, the bells on 6–10.5 s and the result flips out on 13.5 s. */
export const fusionTiming: FusionTiming = {
  intro: introDuration,
  lull: lullDuration,
  image: fusionPulse,
  minimum: introDuration + lullDuration + minimumTurns * fusionPulse,
  climax: fusionPulse,
  afterglow: 1.6,
  fizzle: 1,
}

/** how many turns of the images the intro may show, one for each ingredient, at most four, which the turns after it count on from */
export const introTurns = 4
/** the share of an image’s turn it takes to surface from the swirl, and again to sink back into it */
const surfacing = 0.24

/** How clearly an image whose turn lasts from `from` to `to` seconds shows `elapsed` seconds in, from 0, lost in the swirl, to 1. */
export function clarityBetween(elapsed: number, from: number, to: number) {
  const progress = (elapsed - from) / (to - from)
  if (progress < 0 || progress > 1) {
    return 0
  }
  return Math.min(clamp(progress / surfacing, 0, 1), clamp((1 - progress) / surfacing, 0, 1))
}

/** seconds into a fusion that the images start taking turns, once the intro and the lull are over */
export function firstTurn({intro, lull}: Pick<FusionTiming, 'intro' | 'lull'> = fusionTiming) {
  return intro + lull
}

/** Seconds into a fusion that the next turn of the images begins, `elapsed` seconds in, the end of the intro while it plays and right away during the lull: the beat of the loop on which a fusion the player broke off fizzles. */
export function nextTurn(elapsed: number, timing: Pick<FusionTiming, 'image' | 'intro' | 'lull'> = fusionTiming) {
  const first = firstTurn(timing)
  if (elapsed <= first || timing.image <= 0) {
    return Math.max(elapsed, timing.intro)
  }
  return first + Math.ceil((elapsed - first) / timing.image) * timing.image
}

/** The image the portal shows `elapsed` seconds into a fusion showing `count` images and how clearly, once its intro and lull are over, from the hung portrait’s on; the intro shows its own. */
export function imageAt(elapsed: number, count: number, timing: Pick<FusionTiming, 'image' | 'intro' | 'lull'> = fusionTiming) {
  const first = firstTurn(timing)
  if (elapsed < first || count === 0 || timing.image <= 0) {
    return
  }
  const turn = Math.floor((elapsed - first) / timing.image)
  const start = first + turn * timing.image
  return {
    index: turn % count,
    turn: introTurns + turn,
    clarity: clarityBetween(elapsed, start, start + timing.image),
  }
}
