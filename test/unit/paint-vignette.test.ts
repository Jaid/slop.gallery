import {describe, expect, test} from 'bun:test'

import {halfWidth, strokeEnds, strokeMargin, strokePoint, strokeTaper, vignettePaints, vignetteStrokes} from '../../src/moods/paint/vignetteStrokes.ts'

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
describe('the Paint Orb’s vignette', () => {
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
