import {describe, expect, test} from 'bun:test'

import {asPortrait, portraitRatios, slotArea, slotAreas, slotFrame} from '../../src/lib/placement/portraitSlots.ts'
import {placementIssue} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {galleryPlacement} from './fixtures/gallery.ts'

const slots = slopGallery.portraitSlots()
const occupied = slots.map(asPortrait)
describe('portrait slots', () => {
  test('frames keep their ratio and area at every size', () => {
    for (const ratio of Object.keys(portraitRatios) as Array<keyof typeof portraitRatios>) {
      for (const area of slotAreas) {
        const frame = slotFrame(ratio, area)
        // Frames are rounded to the millimeter.
        expect(frame.width / frame.height).toBeCloseTo(portraitRatios[ratio], 2)
        expect(Math.abs(slotArea(frame) - area) / area).toBeLessThan(0.002)
      }
    }
  })
  test('have unique IDs and frames of their ratio', () => {
    const ids = new Set(slots.map(slot => slot.id))
    expect(ids.size).toBe(slots.length)
    for (const slot of slots) {
      expect(slot.width / slot.height).toBeCloseTo(portraitRatios[slot.ratio], 9)
    }
  })
  test('stay valid hanging spots with every other slot filled', () => {
    for (const slot of slots) {
      const wall = galleryPlacement.wall(slot.wallId)!
      expect(placementIssue(wall, slot.position, slot.width, slot.height, occupied, slot.id, slot.labelAbove)).toBe('')
      expect(galleryPlacement.contains(slot.position)).toBe(true)
    }
  })
})
