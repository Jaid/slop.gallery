import {describe, expect, test} from 'bun:test'

import {vec4} from 'three/tsl'

import {paintOrder} from '../../src/lib/materials/oilPaints.ts'
import {screenMood} from '../../src/lib/rendering/moodScreen.ts'
import {moods} from '../../src/moods/index.ts'
import {moodFade} from '../../src/moods/lib/MoodMixer.ts'
import {paintScreen} from '../../src/moods/paint/PaintScreen.ts'
import {vignetteStrokePoint, vignetteStrokes} from '../../src/moods/paint/strokes.ts'

describe('Paint mood', () => {
  test('replaces global color filters with an animated screen vignette while keeping its atelier ambience', () => {
    const {paint} = moods
    expect(paint.screen).toBe(paintScreen)
    expect(paint.grade).toBeUndefined()
    expect(paint.lamps).toBeUndefined()
    expect(paint.fill).toBeUndefined()
    expect(paint.ambience).toBeDefined()
    expect(screenMood(vec4(0.5, 0.5, 0.5, 1), [paint])).toBeDefined()
  })
  test('draws all twenty vignette brush strokes within the mood fade-in, using the Paint Orb’s pigments and keeping the screen center clear', () => {
    expect(vignetteStrokes).toHaveLength(20)
    const repainting = vignetteStrokes.filter(stroke => stroke.repaintPeriod > 0)
    expect(repainting.length).toBeGreaterThan(0)
    for (const stroke of vignetteStrokes) {
      expect(stroke.delay).toBeGreaterThanOrEqual(0)
      expect(stroke.duration).toBeGreaterThan(0)
      expect(stroke.delay + stroke.duration).toBeLessThanOrEqual(moodFade.in)
      expect(stroke.radius).toBeGreaterThan(0)
      expect(stroke.halfWidth).toBeGreaterThan(0)
      for (const index of stroke.paint) {
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(paintOrder.length)
      }
      for (const aspect of [4 / 3, 16 / 9, 21 / 9]) {
        for (let step = 0; step <= 20; step++) {
          const [u, v] = vignetteStrokePoint(stroke, step / 20, aspect)
          const halfU = stroke.halfWidth / aspect
          const halfV = stroke.halfWidth
          // No sample point (even padded by halfWidth) enters the central 56% × 56% window.
          expect(Math.max(Math.abs(u - 0.5) - halfU, Math.abs(v - 0.5) - halfV)).toBeGreaterThan(0.28)
        }
      }
    }
  })
})
