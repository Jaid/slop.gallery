import {describe, expect, test} from 'bun:test'

import {halfWidth, strokeAt, strokeEnds, strokeMargin, strokePoint, strokeRounds, strokeTaper, vignettePaints, vignetteStrokes} from '../../src/moods/paint/vignetteStrokes.ts'

/** the screens the vignette has to frame, by their width divided by their height: 4:3 up to 21:9 */
const aspects = [4 / 3, 16 / 10, 16 / 9, 21 / 9]
/** how far out a screen point lies, 1 on the ellipse through the middles of the screen’s edges */
const outward = ([x, y]: readonly [number, number], aspect: number) => Math.hypot(x / halfWidth(aspect), y / 0.5)
/** whether the paint of any stroke covers the screen point at the aspect, with a little to spare at its edges */
const covered = (point: readonly [number, number], aspect: number) => vignetteStrokes.some(stroke => {
  for (let step = 0; step <= 200; step++) {
    const share = step / 200
    const [x, y] = strokePoint(stroke, aspect, share)
    if (Math.hypot(point[0] - x, point[1] - y) < stroke.width / 2 * strokeTaper(share) * 0.9) {
      return true
    }
  }
  return false
})
describe('the Atelier’s vignette', () => {
  test('the brushes lay their strokes one after another while the mood comes in, done before it shows in full', () => {
    expect(vignetteStrokes.length).toBeGreaterThan(12)
    for (const [index, stroke] of vignetteStrokes.entries()) {
      expect(stroke.start).toBeGreaterThanOrEqual(index ? vignetteStrokes[index - 1].start : 0)
      expect(stroke.duration).toBeGreaterThan(0)
      expect(stroke.start + stroke.duration).toBeLessThan(1)
      expect(stroke.width).toBeGreaterThan(0)
      expect(stroke.phase).toBeGreaterThanOrEqual(0)
      expect(stroke.phase).toBeLessThan(1)
      expect(stroke.dryness).toBeGreaterThanOrEqual(0)
      expect(stroke.dryness).toBeLessThan(0.5)
      for (const paint of [stroke.paint, stroke.second]) {
        expect(Number.isInteger(paint)).toBe(true)
        expect(vignettePaints[paint]).toMatch(/^#[\da-f]{6}$/)
      }
    }
    // Two brushes are at work at once now and then, and none waits long for the one before.
    const overlapping = vignetteStrokes.slice(1).filter((stroke, index) => stroke.start < vignetteStrokes[index].start + vignetteStrokes[index].duration)
    expect(overlapping.length).toBe(vignetteStrokes.length - 1)
  })
  test('as the mood has arrived, every stroke is laid and none has begun to dry, though each is at another point of its round', () => {
    for (const stroke of vignetteStrokes) {
      expect(strokeAt(stroke, stroke.start - 0.01)).toEqual({
        round: -1,
        laid: 0,
        dried: 0,
      })
      expect(strokeAt(stroke, 1)).toEqual({
        round: 0,
        laid: 1,
        dried: 0,
      })
      expect(stroke.lead).toBeGreaterThanOrEqual(0)
      // The brush is done laying it, also when it takes its time over it again, before it begins to dry.
      expect(stroke.lead + stroke.duration / stroke.period).toBeLessThan(strokeRounds.drying)
      expect(stroke.duration * strokeRounds.patience / stroke.period).toBeLessThan(strokeRounds.drying)
    }
    const leads = new Set(vignetteStrokes.map(stroke => stroke.lead))
    expect(leads.size).toBeGreaterThan(vignetteStrokes.length / 2)
    // The more paint a stroke holds, the longer its rounds: the broadest takes longer than the most slender one.
    const byWidth = vignetteStrokes.toSorted((a, b) => a.width - b.width)
    expect(byWidth.at(-1)!.period).toBeGreaterThan(byWidth[0].period)
    const periods = new Set(vignetteStrokes.map(stroke => stroke.period))
    expect(periods.size).toBe(vignetteStrokes.length)
  })
  test('the brushes never rest: every stroke dries and is laid again round after round without a jump, and somewhere a brush is always at work', () => {
    const tick = 0.004
    const until = 30
    /** when a brush was last laying each stroke, by the clock */
    let lastAtWork = 1
    let longestRest = 0
    const states = vignetteStrokes.map(stroke => strokeAt(stroke, 1))
    for (let clock = 1 + tick; clock <= until; clock += tick) {
      let atWork = false
      for (const [index, stroke] of vignetteStrokes.entries()) {
        const before = states[index]
        const now = strokeAt(stroke, clock)
        if (now.round === before.round) {
          expect(now.laid).toBeGreaterThanOrEqual(before.laid)
          expect(now.dried).toBeGreaterThanOrEqual(before.dried)
          expect(now.dried - before.dried).toBeLessThan(0.02)
          expect(now.laid - before.laid).toBeLessThan(0.1)
        } else {
          // The brush only comes back for a stroke as dry as it gets, and starts over what is left of it.
          expect(now.round).toBe(before.round + 1)
          expect(before.dried).toBeGreaterThan(0.999)
          expect(before.laid).toBe(1)
          expect(now.laid).toBeLessThan(0.01)
          expect(now.dried).toBe(0)
        }
        atWork ||= now.laid > 0 && now.laid < 1
        states[index] = now
      }
      if (atWork) {
        lastAtWork = clock
      }
      // Counted from the first round a stroke can end with.
      if (clock > 1 + Math.max(...strokeRounds.period) * strokeRounds.body) {
        longestRest = Math.max(longestRest, clock - lastAtWork)
      }
    }
    for (const state of states) {
      expect(state.round).toBeGreaterThan(2)
    }
    // No longer than the mood takes to come in.
    expect(longestRest).toBeLessThan(1)
  })
  test('the strokes leave the middle of the view clear on every screen from 4:3 to 21:9', () => {
    for (const aspect of aspects) {
      for (const stroke of vignetteStrokes) {
        for (let step = 0; step <= 100; step++) {
          const share = step / 100
          const point = strokePoint(stroke, aspect, share)
          const next = strokePoint(stroke, aspect, Math.min(1, share + 0.001))
          const previous = strokePoint(stroke, aspect, Math.max(0, share - 0.001))
          const run = Math.hypot(next[0] - previous[0], next[1] - previous[1])
          const left = [(previous[1] - next[1]) / run, (next[0] - previous[0]) / run]
          // the farthest its ragged edges reach to either side
          const reach = stroke.width / 2 * strokeMargin
          for (const side of [-1, 1]) {
            expect(outward([point[0] + left[0] * reach * side, point[1] + left[1] * reach * side], aspect)).toBeGreaterThan(0.7)
          }
        }
      }
    }
  })
  test('the paint gathers in the corners and thins out toward the middles of the edges, like a vignette', () => {
    for (const aspect of aspects) {
      const half = halfWidth(aspect)
      for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
        expect(covered([sx * (half - 0.01), sy * 0.49], aspect)).toBe(true)
      }
      // Points just inside the edges, with how far along their edge they lie from its middle, 0–1.
      const edgePoints = Array.from({length: 41}, (_, index) => index / 20 - 1).flatMap(along => [[along * (half - 0.015), 0.485], [along * (half - 0.015), -0.485], [half - 0.015, along * 0.485], [0.015 - half, along * 0.485]].map(point => [Math.abs(along), point] as const))
      const share = (points: typeof edgePoints) => points.filter(([, point]) => covered(point as [number, number], aspect)).length / points.length
      const nearCorners = share(edgePoints.filter(([along]) => along >= 0.75))
      const nearMiddles = share(edgePoints.filter(([along]) => along <= 0.25))
      expect(nearCorners).toBeGreaterThan(0.95)
      expect(nearMiddles).toBeLessThan(nearCorners * 0.8)
    }
  })
  test('the strokes hang on the screen’s edges, so they slide along with them on a wider screen', () => {
    for (const stroke of vignetteStrokes) {
      const narrow = strokeEnds(stroke, 4 / 3)
      const wide = strokeEnds(stroke, 21 / 9)
      const slide = halfWidth(21 / 9) - halfWidth(4 / 3)
      expect(wide.from[0] - narrow.from[0]).toBeCloseTo(stroke.anchorFrom[0] * slide, 9)
      expect(wide.to[0] - narrow.to[0]).toBeCloseTo(stroke.anchorTo[0] * slide, 9)
      expect(wide.from[1]).toBeCloseTo(narrow.from[1], 9)
      expect(wide.to[1]).toBeCloseTo(narrow.to[1], 9)
    }
  })
})
