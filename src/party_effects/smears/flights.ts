import type {ImpastoPaint} from '#src/lib/materials/impastoPaints.ts'
import type {PartyOffset} from '../lib/partySite.ts'

import {impastoIndex} from '#src/lib/materials/impastoPaints.ts'

/** a smear of heavy paint that an unseen palette knife slaps into the air around its origin and drags out away from it */
export type KnifeSmear = {
  /** where around the origin the knife sets down, as an angle in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** how far its middle bows off the straight path, in meters, the way the burst swirls where positive, as a hand sweeps the knife */
  bend: number
  /** how many seconds after the burst it starts crumbling away */
  crumble: number
  /** seconds after the burst that the knife sets down */
  delay: number
  /** seconds the knife takes from setting down to lifting off */
  duration: number
  /** how far out of the wall’s plane in front of the origin it lies, in meters, the later smears in front of the earlier ones */
  out: number
  /** the paint the knife was loaded with, an index into `impastoOrder`, and the paint folded through it, the same for none */
  paint: readonly [number, number]
  /** sets its folds, its scoring and its cracks apart from the others’, 0–1 */
  phase: number
  /** how far out from the origin the knife sets down and lifts off, in meters */
  reach: readonly [start: number, end: number]
  /** which ring around the origin it belongs to, from the one hugging its rim outward */
  ring: number
  /** how far the knife’s path leans off pointing straight out from the origin, in radians, the way the burst swirls */
  slant: number
  /** how wide the knife’s blade is, in meters */
  width: number
}

/** seconds after the burst that the first smear starts crumbling away, how much later the last one does and how long each takes, its cracks opening first and its flakes dropping out after */
export const smearCrumbling = {
  start: 2.5,
  stagger: 0.6,
  seconds: 0.8,
} as const
/** how fast the smears swell out from the origin a second once they are laid, as a share of their reach, how fast they drift out into the room, in m/s, how fast the whole burst turns round the origin, in radians a second, and how far a smear slides on out from the origin with the slap’s momentum, in meters, most of it within the seconds given */
export const smearDrift = {
  swell: 0.01,
  out: 0.045,
  spin: 0.1,
  slide: 0.07,
  sliding: 0.3,
} as const
/** how fast the crumbling paint drops, in m/s², slower than a stone, as the air holds the flakes up a little */
export const smearFall = 0.35
/** how far a smear is squashed onto its site as the knife slaps it down, overshooting its own size, and how fast it springs back, in seconds */
export const smearSlap = {
  overshoot: 0.16,
  seconds: 0.12,
} as const
/** how much wider a smear spreads where the knife set down and where it lifted off than its blade is */
export const smearSpreading = [0.55, 1.12] as const
/** how far a smear’s quad reaches to either side of its middle line, in its half widths, with room for the paint squeezed out from under the blade and the antialiasing, and how far beyond where the knife set down and lifted off, in its widths, with room for the heap of paint pushed ahead of the blade */
export const smearQuad = {
  margin: 1.25,
  caps: 0.5,
} as const
/** how far round its middle line a smear reaches at most, in widths of its blade: as wide as its quad while the slap squashes it widest, and past either end */
export const smearSpread = Math.max(0.5 * smearQuad.margin * (1 + smearSlap.overshoot) * smearSpreading[1], smearQuad.caps)

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const between = (index: number, seed: number, low: number, high: number) => low + sequence(index, seed) * (high - low)
/** the rings of smears around the origin, from the one hugging its rim outward, like the petals of a sunflower: how many smears, how far out the knife sets down and lifts off, how far out of the wall’s plane, how wide the knife is, how far its path leans and where around the first sets down, in turns */
const rings = [
  {
    count: 10,
    reach: [0.62, 1.02],
    out: 0.07,
    width: 0.19,
    slant: 0.32,
    offset: 0.03,
  },
  {
    count: 10,
    reach: [0.86, 1.24],
    out: 0.16,
    width: 0.22,
    slant: 0.24,
    offset: 0.095,
  },
  {
    count: 8,
    reach: [1.02, 1.28],
    out: 0.27,
    width: 0.15,
    slant: 0.18,
    offset: 0.01,
  },
] as const
/** the paints the knife takes turns in, and the one folded through it, if any: the dusk’s warm lights against its deep cool shadows, cut with white */
const loads: ReadonlyArray<readonly [ImpastoPaint, ImpastoPaint?]> = [
  ['naplesYellow', 'titaniumWhite'],
  ['prussianBlue'],
  ['cadmiumOrange', 'naplesYellow'],
  ['cobaltTeal', 'titaniumWhite'],
  ['alizarinCrimson', 'cadmiumOrange'],
  ['titaniumWhite', 'naplesYellow'],
  ['prussianBlue', 'cobaltTeal'],
  ['cadmiumOrange'],
  ['cobaltTeal'],
  ['naplesYellow', 'cadmiumOrange'],
  ['alizarinCrimson', 'prussianBlue'],
]
/** seconds from when the knife sets down one smear to when it sets down the next */
const pace = 0.05

/**
 * A burst of thick smears that an unseen palette knife slaps into the air around the origin one after another, ring by ring outward, each dragged out away from it like a petal of a sunflower, leaning the same way round, every smear in a paint of its own and some with a second one folded through it, then drifting out into the room until the paint sets and crumbles away.
 * They are listed from the ring nearest the wall outward, the order they are drawn in.
 */
export const knifeSmears: ReadonlyArray<KnifeSmear> = rings.flatMap((ring, ringIndex) => {
  const before = rings.slice(0, ringIndex).reduce((sum, {count}) => sum + count, 0)
  return Array.from({length: ring.count}, (_, index): KnifeSmear => {
    const order = before + index
    const [paint, folded = paint] = loads[order % loads.length]
    const phase = sequence(order * 19, 0.41)
    return {
      ring: ringIndex,
      delay: 0.04 + order * pace + between(order, 0.23, 0, 0.025),
      duration: between(order * 3, 0.61, 0.1, 0.16),
      angle: (index / ring.count + ring.offset + between(order * 5, 0.17, -0.025, 0.025)) * Math.PI * 2,
      reach: [ring.reach[0] * between(order * 11, 0.83, 0.96, 1.04), ring.reach[1] * between(order * 13, 0.39, 0.96, 1.04)],
      slant: ring.slant * between(order * 7, 0.57, 0.75, 1.25),
      bend: between(order * 23, 0.47, 0.01, 0.045),
      out: ring.out + between(order * 29, 0.11, 0, 0.02),
      width: ring.width * between(order * 17, 0.31, 0.85, 1.12),
      paint: [impastoIndex(paint), impastoIndex(folded)],
      phase,
      crumble: smearCrumbling.start + phase * smearCrumbling.stagger,
    }
  })
})

/** seconds after the burst that the last smear has crumbled away */
export const smearsDone = Math.max(...knifeSmears.map(({crumble}) => crumble + smearCrumbling.seconds))

/** The way the knife drags the smear, as an angle in the wall’s plane, `seconds` after it was set down: out from the origin, leaning by its slant, turning with the burst. */
export function smearHeading({angle, slant}: KnifeSmear, seconds: number) {
  return angle + slant + smearDrift.spin * Math.max(0, seconds)
}

/** How far the smear’s path bows off straight `share` of the way along it, in meters, most in its middle and none at either end. */
export function smearBow({bend}: KnifeSmear, share: number) {
  const along = Math.min(1, Math.max(0, share))
  return bend * 4 * along * (1 - along)
}

/** How far the smear has slid on out from the origin with the slap’s momentum `seconds` after it was set down, in meters. */
export function smearSlide(seconds: number) {
  return smearDrift.slide * (1 - Math.exp(-Math.max(0, seconds) / smearDrift.sliding))
}

/** How far the smear has dropped `seconds` after it was set down, once it started crumbling, in meters. */
export function smearDrop({crumble, delay}: KnifeSmear, seconds: number) {
  const falling = Math.max(0, seconds - (crumble - delay))
  return smearFall / 2 * falling * falling
}

/**
 * Where on the smear the point `share` of the way from where the knife set down to where it lifted off lies, `seconds` after it was set down, from the origin: on a straight path out from the origin, leaning by its slant, and, once laid, sliding on out with the slap, swelling out, turning with the burst and drifting into the room, then dropping as it crumbles.
 * `SlappedSmears` lays them out the same way on the GPU.
 */
export function smearPoint(smear: KnifeSmear, share: number, seconds: number): PartyOffset {
  const since = Math.max(0, seconds)
  const swell = 1 + smearDrift.swell * since
  const around = smear.angle + smearDrift.spin * since
  const heading = smearHeading(smear, since)
  const [start, end] = smear.reach
  const along = start + (end - start) * share
  // The knife sets down on the ring at its angle and drags on along its heading, bowing off it the way the burst swirls.
  const setDown = start * swell + smearSlide(since)
  const bow = smearBow(smear, share) * swell
  const x = Math.cos(around) * setDown + Math.cos(heading) * (along - start) * swell - Math.sin(heading) * bow
  const y = Math.sin(around) * setDown + Math.sin(heading) * (along - start) * swell + Math.cos(heading) * bow - smearDrop(smear, since)
  return [x, y, smear.out + smearDrift.out * since]
}

/** How far the smear’s quad reaches to either side of its middle line, in meters, `share` of the way along it, `seconds` after it was set down: as wide as the blade, narrower where it set down and spreading toward where it lifted off, squashed wider by the slap at first, with room round the paint. `SlappedSmears` lays its quads out the same way. */
export function smearReach({width}: KnifeSmear, share: number, seconds: number) {
  const slap = 1 + smearSlap.overshoot * Math.exp(-Math.max(0, seconds) / smearSlap.seconds)
  const spreading = smearSpreading[0] + (smearSpreading[1] - smearSpreading[0]) * Math.min(1, Math.max(0, share))
  return width * 0.5 * slap * spreading * smearQuad.margin
}
