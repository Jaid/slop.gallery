/**
 * The brush strokes of the Paint Orb’s vignette, laid around the edges of the screen in the order the brush sets them down: the dark ground hatched across the corners and brushed along the edges first, then the earth tones over it and last a few bright accents on the inner rim, leaving the middle of the view clear.
 * None of them stays as it is: each dries into bristle streaks after a while and the brush comes back to lay it again over what is left of it, round after round, every stroke at a pace of its own, so the brushes never rest while the mood holds.
 * Screen points are in screen heights from the middle, x to the right and y up, so the screen spans ±{@link halfWidth} across and ±0.5 up and down. A stroke’s ends hang on the screen’s edges, so they slide along with them as its aspect changes.
 */

/** the paints the vignette is laid in, display colors in sRGB; strokes name them by their index */
export const vignettePaints = [
  // the dark ground: ultramarine deepened with umber, and the umber itself
  '#2c3a6e',
  '#573a26',
  // the earth tones and a cool gray blue, as the Atelier’s old grade had them
  '#b98a4c',
  '#2d6b5a',
  '#5b6f9a',
  // the accents, from the Paint Orb’s own tubes
  '#c8482a',
  '#dfa93c',
  '#ebe0c8',
] as const
const paint = {
  ultramarine: 0,
  umber: 1,
  ochre: 2,
  viridian: 3,
  slate: 4,
  vermilion: 5,
  cadmiumYellow: 6,
  titaniumWhite: 7,
} as const

export type VignetteStroke = {
  /** where the brush sets down, as a point on the screen’s edges, −1–1 of its half width and half height, like (−1, 1) for the upper left corner */
  anchorFrom: readonly [x: number, y: number]
  /** where the brush lifts off, as a point on the screen’s edges like {@link anchorFrom} */
  anchorTo: readonly [x: number, y: number]
  /** how far the stroke bows off the straight line between its ends at its middle, in screen heights, to the left of where it runs */
  bow: number
  /** how dry the brush was, 0–1: a dry one only scumbles the paint on, in broken streaks the view shows through */
  dryness: number
  /** how much of the mood’s arrival the brush takes to lay it, 0–1 */
  duration: number
  /** how far from its anchor the brush sets down, in screen heights */
  from: readonly [x: number, y: number]
  /** how much of its first round the stroke skips, 0–1, so that the strokes, all first laid within the one arrival, don’t dry and get laid again as one */
  lead: number
  /** the index of its paint in {@link vignettePaints} */
  paint: number
  /** how long one of its rounds takes, from the brush laying it to the brush coming back for it, in arrivals, the time the mood takes to come in */
  period: number
  /** a number 0–1 of its own that its grooves, its ragged edges and the wavering of its paint follow */
  phase: number
  /** the index of the second paint the brush was dipped into on one side */
  second: number
  /** when the brush first sets down, as how far the mood has arrived, 0–1 */
  start: number
  /** how far from its anchor the brush lifts off, in screen heights */
  to: readonly [x: number, y: number]
  /** how wide the stroke is where the brush is pressed down fully, in screen heights */
  width: number
}

/** how far a stroke’s brush reaches out sideways at most, in its half widths: its ragged edges and the paint it squeezes out */
export const strokeMargin = 1.3
/** how much of the mood’s arrival the last stroke is laid by, so the vignette stands complete a little before the mood shows in full */
const laidBy = 0.92
/** how the strokes go round after they were first laid */
export const strokeRounds = {
  /** how many times longer the round of the broadest stroke takes than that of the most slender one: the more paint a stroke holds, the longer it takes to dry */
  body: 1.5,
  /** the share of a round after which a stroke begins to dry, as dry as it gets by the round’s end */
  drying: 0.4,
  /** how many times longer the brush takes to lay a stroke again than it took the first time, when it was in a hurry to have the vignette stand */
  patience: 2,
  /** the shortest and the longest a round of the most slender stroke takes, in arrivals */
  period: [2.4, 4],
} as const
/** A pseudo-random number from 0 to 1 for the number, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** a number between `low` and `high` for the seed */
const between = (seed: number, low: number, high: number) => low + scatter(seed) * (high - low)
/** the screen’s half width in screen heights at the aspect, its width divided by its height */
export const halfWidth = (aspect: number) => aspect / 2

/** the corners in the order the brush works round them: upper left, upper right, lower right, lower left */
const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const

type Layout = Omit<VignetteStroke, 'duration' | 'lead' | 'period' | 'phase' | 'start'>
type Point = readonly [x: number, y: number]

/** the brush’s dryness for the dark ground, which is only scumbled on, and for the paint over it */
const dryness = {
  ground: 0.16,
  paint: 0,
}
/** 1 if the left of a stroke run from `from` to `to` lies toward `toward`, else −1, which turns a bow toward it */
function sideToward(from: Point, to: Point, toward: Point) {
  const left = [from[1] - to[1], to[0] - from[0]]
  return Math.sign(left[0] * toward[0] + left[1] * toward[1]) || 1
}
/** A stroke hatched across a corner, square to its diagonal, `depth` screen heights in from the corner along it, bowing toward the corner, so the clear middle rounds off there like a vignette. */
function cornerStroke([sx, sy]: Point, depth: number, length: number, width: number, paints: readonly [number, number], brush: number, seed: number): Layout {
  const inward = [-sx / Math.SQRT2, -sy / Math.SQRT2] as const
  const tilt = between(seed, -0.22, 0.22)
  // Square to the diagonal, turned a little off it.
  const across = [-inward[1], inward[0]]
  const along = [across[0] * Math.cos(tilt) - across[1] * Math.sin(tilt), across[0] * Math.sin(tilt) + across[1] * Math.cos(tilt)]
  const middle = [inward[0] * depth, inward[1] * depth]
  const reach = length / 2
  const from: Point = [middle[0] - along[0] * reach, middle[1] - along[1] * reach]
  const to: Point = [middle[0] + along[0] * reach, middle[1] + along[1] * reach]
  return {
    anchorFrom: [sx, sy],
    anchorTo: [sx, sy],
    from,
    to,
    bow: sideToward(from, to, [-inward[0], -inward[1]]) * length * between(seed + 0.5, 0.1, 0.18),
    width,
    paint: paints[0],
    second: paints[1],
    dryness: brush,
  }
}
/** A stroke run along an edge from a corner toward the middle of that edge, `inset` screen heights in from it, drifting farther in as it goes, so it peels off the edge and tapers out into the view instead of boxing it in. */
function edgeStroke([sx, sy]: Point, horizontal: boolean, inset: number, length: number, width: number, paints: readonly [number, number], brush: number, seed: number): Layout {
  const drift = between(seed, 0.02, 0.05)
  const start = between(seed + 0.3, -0.03, 0.01)
  const from: Point = horizontal ? [-sx * start, -sy * inset] : [-sx * inset, -sy * start]
  const to: Point = horizontal ? [-sx * length, -sy * (inset + drift)] : [-sx * (inset + drift), -sy * length]
  return {
    anchorFrom: [sx, sy],
    anchorTo: [sx, sy],
    from,
    to,
    // Bowing out toward the edge, as the hand swung from the corner.
    bow: between(seed + 0.7, 0.008, 0.03) * sideToward(from, to, horizontal ? [0, sy] : [sx, 0]),
    width,
    paint: paints[0],
    second: paints[1],
    dryness: brush,
  }
}
/**
 * Lays the strokes out one after another over the mood’s arrival, each taking a little longer than the gap to the next, so two brushes are often at work at once, and gives each a round of its own length to dry away and be laid again in.
 * Each skips some of its first round, though never so much that it would begin to dry before the mood has arrived: as the mood arrives, the vignette stands complete and wet.
 */
function schedule(layouts: ReadonlyArray<Layout>): Array<VignetteStroke> {
  const durations = layouts.map((_, index) => between(index * 3.7 + 11, 0.13, 0.2))
  const gap = (laidBy - durations.at(-1)!) / (layouts.length - 1)
  const widths = layouts.map(layout => layout.width)
  const slender = Math.min(...widths)
  const broad = Math.max(...widths)
  return layouts.map((layout, index) => {
    const start = index * gap
    const period = between(index * 2.3 + 5, ...strokeRounds.period) * (1 + (strokeRounds.body - 1) * (layout.width - slender) / (broad - slender))
    return {
      ...layout,
      start,
      duration: durations[index],
      period,
      lead: scatter(index * 7.9 + 3) * Math.max(0, strokeRounds.drying - 0.04 - (1 - start) / period),
      phase: scatter(index * 5.3 + 2),
    }
  })
}
/** the earth tones each corner is laid in over the ground, and its accents on the inner rim, the first of each the paint and the second what the brush was dipped into besides */
const cornerPaints = [
  {
    earth: [paint.ochre, paint.viridian],
    accents: [[paint.vermilion, paint.cadmiumYellow], [paint.titaniumWhite, paint.ochre]],
  },
  {
    earth: [paint.slate, paint.ochre],
    accents: [[paint.titaniumWhite, paint.slate]],
  },
  {
    earth: [paint.viridian, paint.ochre],
    accents: [[paint.cadmiumYellow, paint.vermilion], [paint.titaniumWhite, paint.viridian]],
  },
  {
    earth: [paint.ochre, paint.slate],
    accents: [[paint.cadmiumYellow, paint.titaniumWhite]],
  },
] as const satisfies ReadonlyArray<{
  accents: ReadonlyArray<readonly [number, number]>
  earth: readonly [number, number]
}>

/** The vignette’s strokes in the order they are laid, each over the ones before, every corner a little different; the middles of the edges stay open, like a vignette’s. */
export const vignetteStrokes: ReadonlyArray<VignetteStroke> = schedule([
  // The dark ground hatched broadly across every corner and brushed out along the edges from it, the long edge first.
  ...corners.map((corner, index) => cornerStroke(corner, between(index + 1, 0.035, 0.07), between(index + 2, 0.54, 0.68), between(index + 3, 0.15, 0.19), index % 2 ? [paint.umber, paint.ultramarine] : [paint.ultramarine, paint.umber], dryness.ground, index)),
  ...corners.flatMap((corner, index) => [
    edgeStroke(corner, true, between(index + 21, 0.02, 0.04), between(index + 20, 0.42, 0.58), between(index + 22, 0.075, 0.1), [paint.ultramarine, paint.umber], dryness.ground, index + 20),
    edgeStroke(corner, false, between(index + 31, 0.02, 0.04), between(index + 30, 0.28, 0.38), between(index + 32, 0.07, 0.095), [paint.umber, paint.ultramarine], dryness.ground, index + 30),
  ]),
  // The earth tones over the ground, a little farther in, along one of the edges too.
  ...corners.flatMap((corner, index) => [
    cornerStroke(corner, between(index + 51, 0.125, 0.16), between(index + 52, 0.48, 0.6), between(index + 53, 0.1, 0.13), cornerPaints[index].earth, dryness.paint, index + 50),
    edgeStroke(corner, scatter(index + 61) < 0.5, between(index + 62, 0.075, 0.095), between(index + 60, 0.28, 0.4), between(index + 63, 0.055, 0.07), [cornerPaints[index].earth[0], paint.umber], dryness.paint, index + 60),
  ]),
  // Bright accents on the inner rim, last: a slender stroke in every corner and a short one beside it in some.
  ...corners.flatMap((corner, index) => cornerPaints[index].accents.map((paints, accent) => cornerStroke(corner, accent ? between(index + 71, 0.195, 0.215) : between(index + 72, 0.225, 0.245), accent ? between(index + 73, 0.16, 0.22) : between(index + 74, 0.36, 0.46), accent ? 0.045 : between(index + 75, 0.055, 0.07), paints, dryness.paint, index + 70 + accent * 5))),
])

/** Where on the screen of the aspect a stroke sets down and lifts off, in screen heights from the middle. */
export function strokeEnds(stroke: VignetteStroke, aspect: number) {
  const half = halfWidth(aspect)
  const place = (anchor: readonly [number, number], offset: readonly [number, number]) => [anchor[0] * half + offset[0], anchor[1] * 0.5 + offset[1]] as const
  return {
    from: place(stroke.anchorFrom, stroke.from),
    to: place(stroke.anchorTo, stroke.to),
  }
}

/** The point on the middle line of a stroke on the screen of the aspect, `share` 0–1 of the way from where it sets down to where it lifts off, as the screen shader lays it out. */
export function strokePoint(stroke: VignetteStroke, aspect: number, share: number) {
  const {from, to} = strokeEnds(stroke, aspect)
  const span = [to[0] - from[0], to[1] - from[1]]
  const length = Math.hypot(span[0], span[1])
  const left = [-span[1] / length, span[0] / length]
  const bow = stroke.bow * Math.sin(Math.PI * share)
  return [from[0] + span[0] * share + left[0] * bow, from[1] + span[1] * share + left[1] * bow] as const
}

/** GLSL’s smoothstep */
const smooth = (low: number, high: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}
/**
 * How a stroke stands at `clock`, the mood’s time in arrivals, which is how far the mood has arrived and counts on from 1 once it has, as the screen shader has it: the round it is in, −1 before the brush first set down, how far the brush has laid it in this round, 0–1, over what the round before left of it, and how far it has dried since, 0–1, as dry as it gets when the brush comes back.
 */
export function strokeAt(stroke: VignetteStroke, clock: number) {
  const since = clock - stroke.start
  if (since < 0) {
    return {
      round: -1,
      laid: 0,
      dried: 0,
    }
  }
  const turn = since / stroke.period + stroke.lead
  const round = Math.floor(turn)
  const phase = turn - round
  // how long ago the brush set down for this round, in arrivals
  const passed = (phase - (round ? 0 : stroke.lead)) * stroke.period
  return {
    round,
    laid: smooth(0, stroke.duration * (round ? strokeRounds.patience : 1), passed),
    dried: smooth(strokeRounds.drying, 1, phase),
  }
}

/** How wide a stroke is `share` 0–1 of the way along, in its full width: pressed down as the brush sets out, then easing off and tapering toward where it lifts off. */
export function strokeTaper(share: number) {
  return (0.72 + 0.28 * smooth(0, 0.22, share)) * (1 - 0.45 * smooth(0.45, 1, share))
}
