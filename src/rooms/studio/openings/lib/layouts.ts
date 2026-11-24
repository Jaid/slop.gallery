import type {Spread} from '../base/OpeningStyle.ts'
import type {Point} from './polygons.ts'

import {point} from './polygons.ts'

/** where a layout puts one motif: its middle, and how far the motif may reach from it */
export type Slot = {
  middle: Point
  reach: Spread
}
export type LayoutOptions = {
  /** the least room between two motifs, in meters */
  gap: number
  /** how far the smallest motif of a flank or a corner may still reach */
  least: number
  /** whether a motif keeps within the circle of its reach, which lets motifs pack closer than their boxes would */
  round: boolean
  /** whether a motif fills a reach longer one way than the other, rather than only a square of its shorter side */
  stretches: boolean
  /** how far the motifs of a grid or of staggered rows would like to reach */
  wanted: number
}

/** The one motif filling the whole spread, for motifs that stretch. */
export function field(spread: Spread, {stretches}: LayoutOptions): Array<Slot> | undefined {
  if (!stretches) {
    return
  }
  return [{
    middle: point(0, 0),
    reach: spread,
  }]
}

/** As many motifs side by side along the longer axis as cover the most of it, each as deep as the spread, the outer ones at its ends; a single one if the spread is about as deep as it is long. */
export function row(spread: Spread, {gap, stretches}: LayoutOptions): Array<Slot> {
  const {long, short, slot} = axes(spread)
  const length = (count: number) => (long * 2 - gap * (count - 1)) / count / 2
  if (stretches) {
    // Each as long as it is deep, near enough.
    const count = Math.max(1, Math.round((long * 2 + gap) / (short * 2 + gap)))
    return justify(count, long, length(count)).map(along => slot(along, 0, length(count), short))
  }
  const reach = (count: number) => Math.min(short, length(count))
  // As many as fit at the spread’s whole depth, or one more a little smaller, whichever covers more.
  const fewer = Math.max(1, Math.floor((long * 2 + gap) / (short * 2 + gap)))
  const count = (fewer + 1) * reach(fewer + 1) ** 2 > fewer * reach(fewer) ** 2 ? fewer + 1 : fewer
  return justify(count, long, reach(count)).map(along => slot(along, 0, reach(count)))
}

/**
 * Columns and rows of motifs about as large as wanted, covering the spread to its edges.
 * Motifs that don’t stretch keep to squares as large as the tighter axis lets them be, and the other axis takes as many as fit at that size or one more a little smaller, whichever covers more.
 */
export function grid(spread: Spread, {gap, stretches, wanted}: LayoutOptions): Array<Slot> {
  const each = (span: number, count: number) => (span * 2 - gap * (count - 1)) / count / 2
  let [columns, rows] = [spread.x, spread.y].map(span => Math.max(1, Math.round((span * 2 + gap) / (wanted * 2 + gap))))
  if (!stretches) {
    const looseX = each(spread.x, columns) > each(spread.y, rows)
    const [loose, tight] = looseX ? [spread.x, each(spread.y, rows)] : [spread.y, each(spread.x, columns)]
    // How many fit at the tight axis’ size, the slightest rounding error forgiven.
    const fewer = Math.max(1, Math.floor((loose * 2 + gap) / (tight * 2 + gap) + 1e-9))
    const covers = (count: number) => count * Math.min(tight, each(loose, count)) ** 2
    const count = covers(fewer + 1) > covers(fewer) ? fewer + 1 : fewer
    ;[columns, rows] = looseX ? [count, rows] : [columns, count]
  }
  const [x, y] = [each(spread.x, columns), each(spread.y, rows)]
  const reach = stretches ? {
    x,
    y,
  } : {
    x: Math.min(x, y),
    y: Math.min(x, y),
  }
  return justify(columns, spread.x, reach.x).flatMap(middleX => justify(rows, spread.y, reach.y).map(middleY => ({
    middle: point(middleX, middleY),
    reach,
  })))
}

/** Rows of motifs about as large as wanted, every other row shifted half a step and one shorter, round motifs packed like the cells of a honeycomb and others like bricks, then grown and drawn apart to the spread’s edges; at least two rows of two. */
export function staggered(spread: Spread, {gap, round, wanted}: LayoutOptions): Array<Slot> | undefined {
  const {long, short, slot} = axes(spread)
  /** how much closer rows come than motifs along them */
  const closer = round ? Math.sqrt(3) / 2 : 1
  const step = (reach: number) => (reach * 2 + gap) * closer
  const start = Math.min(wanted, short)
  let rows = Math.floor((short - start) * 2 / step(start)) + 1
  const columns = Math.floor((long - start) * 2 / (start * 2 + gap)) + 1
  if (rows < 2 || columns < 2) {
    return
  }
  // An odd count of rows keeps the long ones at both edges.
  if (rows > 2 && rows % 2 === 0) {
    rows--
  }
  // As large as the rows and columns still fit.
  const reach = Math.min(short, (long * 2 - (columns - 1) * gap) / (columns * 2), (short * 2 - (rows - 1) * gap * closer) / ((rows - 1) * closer * 2 + 2))
  const pitch = reach * 2 + gap
  const [alongScale, acrossScale] = [(long - reach) * 2 / ((columns - 1) * pitch), (short - reach) * 2 / ((rows - 1) * step(reach))]
  return Array.from({length: rows}, (_, line) => line).flatMap(line => {
    const count = line % 2 ? columns - 1 : columns
    const across = (line - (rows - 1) / 2) * step(reach) * acrossScale
    return Array.from({length: count}, (_, index) => slot((index - (count - 1) / 2) * pitch * alongScale, across, reach))
  })
}

/** One motif as deep as the spread in its middle, flanked on either side by columns of smaller ones, each column no larger than four fifths of the last, as many columns as fit, the outer ones at the spread’s ends. */
export function flanked(spread: Spread, {gap, least}: LayoutOptions): Array<Slot> | undefined {
  const {long, short, slot} = axes(spread)
  const columns: Array<{
    at: number
    count: number
    reach: number
  }> = []
  let [from, previous] = [short + gap, short]
  for (;;) {
    const room = long - from
    // As many in the column as cover the most of it.
    const best = [1, 2, 3, 4].map(count => ({
      count,
      reach: Math.min(room / 2, (short * 2 - gap * (count - 1)) / count / 2, previous * 0.8),
    })).reduce((chosen, option) => (option.count * option.reach ** 2 > chosen.count * chosen.reach ** 2 ? option : chosen))
    if (best.reach < least) {
      break
    }
    columns.push({
      ...best,
      at: from + best.reach,
    })
    from += best.reach * 2 + gap
    previous = best.reach
  }
  const last = columns.at(-1)
  if (!last) {
    return
  }
  const stretch = (long - last.reach - short) / (last.at - short)
  return [slot(0, 0, short), ...columns.flatMap(({at, count, reach}) => [-1, 1].flatMap(side => justify(count, short, reach).map(across => slot(side * (short + (at - short) * stretch), across, reach))))]
}

/** One round motif in the middle, nearly as deep as the spread as `middle` says, and one in each corner, as large as fits between it and the other corners; for spreads up to twice as long as deep. */
export function medallion(spread: Spread, {gap, least, round}: LayoutOptions, middle: number): Array<Slot> | undefined {
  const {long, short, slot} = axes(spread)
  if (!round || long > short * 2) {
    return
  }
  const center = short * middle
  const clears = (reach: number) => Math.hypot(long - reach, short - reach) >= center + gap + reach
  let [small, large] = [0, (short * 2 - gap) / 4]
  for (let step = 0; step < 24; step++) {
    const reach = (small + large) / 2
    if (clears(reach)) {
      small = reach
    } else {
      large = reach
    }
  }
  if (small < least) {
    return
  }
  return [slot(0, 0, center), ...[-1, 1].flatMap(along => [-1, 1].map(across => slot(along * (long - small), across * (short - small), small)))]
}

/** The spread’s longer and shorter reach, and slots made along and across them, put back onto x and y. */
function axes(spread: Spread) {
  const turned = spread.y > spread.x
  return {
    long: turned ? spread.y : spread.x,
    short: turned ? spread.x : spread.y,
    slot: (along: number, across: number, reachAlong: number, reachAcross = reachAlong): Slot => (turned ? {
      middle: point(across, along),
      reach: {
        x: reachAcross,
        y: reachAlong,
      },
    } : {
      middle: point(along, across),
      reach: {
        x: reachAlong,
        y: reachAcross,
      },
    }),
  }
}
/** The middles of `count` motifs reaching `reach`, spaced evenly over a span reaching `span` either way, the outer ones at its ends. */
function justify(count: number, span: number, reach: number) {
  if (count === 1) {
    return [0]
  }
  return Array.from({length: count}, (_, index) => -span + reach + index * (span - reach) * 2 / (count - 1))
}
