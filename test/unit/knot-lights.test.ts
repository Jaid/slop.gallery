import {expect, test} from 'bun:test'

import {knotBays, knotLayout} from 'knot-materials/exhibition.ts'
import KnotLayout from 'knot-materials/KnotLayout.ts'
import KnotLightDamage, {isKnotLightDamageImpact, knotLight, knotLightFlicker, knotLightFracture, knotLightImpactEnergy, knotLightSlots} from 'knot-materials/KnotLights.ts'

import {knotGalleryBounds} from '../../src/lib/gallery/knotGallery.ts'

test('every candidate row gets a pane over every slot in the longest row', () => {
  const exhibitionSlots = knotLightSlots(knotLayout, knotBays.length, knotGalleryBounds.height)
  expect(exhibitionSlots).toHaveLength(knotBays.length * knotLayout.maxRowLength)
  expect(new Set(knotBays.map((_, row) => exhibitionSlots.filter(slot => slot.row === row).length))).toEqual(new Set([knotLayout.maxRowLength]))
  const layout = new KnotLayout([1, 4, 2])
  const slots = knotLightSlots(layout, 3, 5.8)
  expect(layout.maxRowLength).toBe(4)
  expect(slots).toHaveLength(12)
  for (let row = 0; row < 3; row++) {
    const rowSlots = slots.filter(slot => slot.row === row)
    expect(rowSlots).toHaveLength(4)
    expect(rowSlots.map(slot => slot.position[0])).toEqual(Array.from({length: 4}, (_, slot) => layout.slotX(slot)))
    expect(rowSlots.every(slot => slot.position[1] === 5.8 - knotLight.ceilingInset)).toBe(true)
    expect(rowSlots.every(slot => slot.position[2] === layout.rowZ(row))).toBe(true)
  }
})
test('a lone Knot gets four panes in a square around the spot above it', () => {
  const layout = new KnotLayout([1])
  const slots = knotLightSlots(layout, 1, 5.8)
  expect(slots).toHaveLength(4)
  const ids = new Set(slots.map(slot => slot.id))
  expect(ids.size).toBe(4)
  expect(slots.reduce((sum, slot) => sum + slot.position[0], 0) / 4).toBeCloseTo(layout.slotX(0), 9)
  expect(slots.reduce((sum, slot) => sum + slot.position[2], 0) / 4).toBeCloseTo(layout.rowZ(0), 9)
  for (const slot of slots) {
    expect(Math.abs(slot.position[0] - layout.slotX(0))).toBeGreaterThan(knotLight.size[0] / 2)
    expect(Math.abs(slot.position[2] - layout.rowZ(0))).toBeGreaterThan(knotLight.size[2] / 2)
    expect(slot.position[1]).toBe(5.8 - knotLight.ceilingInset)
  }
})
test('impact fractures isolate exactly one dead diffuser corner behind a line through the impact', () => {
  for (const [index, point] of [[0.34, -0.42], [-0.76, 0.18], [0.02, 0.03], [0.88, 0.79]].entries()) {
    const fracture = knotLightFracture(point as [number, number], [4 - index, 1 + index], 17 + index)
    expect(Math.hypot(...fracture.normal)).toBeCloseTo(1, 9)
    expect(fracture.liveFraction).toBeGreaterThanOrEqual(0.5)
    expect(fracture.liveFraction).toBeLessThan(1)
    const [corner, firstEdge, secondEdge] = fracture.deadTriangle
    const edgeCross = (firstEdge[0] - fracture.point[0]) * (secondEdge[1] - fracture.point[1]) - (firstEdge[1] - fracture.point[1]) * (secondEdge[0] - fracture.point[0])
    expect(Math.abs(edgeCross)).toBeLessThan(1e-9)
    expect(corner.every(value => Math.abs(value) === 1)).toBe(true)
    expect(firstEdge.every(value => Math.abs(value) <= 1 + 1e-9)).toBe(true)
    expect(secondEdge.every(value => Math.abs(value) <= 1 + 1e-9)).toBe(true)
    const deadCorners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].filter(([x, z]) => (x - fracture.point[0]) * fracture.normal[0] + (z - fracture.point[1]) * fracture.normal[1] > 1e-6)
    expect(deadCorners).toHaveLength(1)
  }
  expect(knotLightFracture([0.2, -0.25], [6, 0.2], 9)).not.toEqual(knotLightFracture([0.2, -0.25], [0.2, 6], 9))
  expect(knotLightFracture([0.2, -0.25], [6, 0.2], 9)).toEqual(knotLightFracture([0.2, -0.25], [6, 0.2], 9))
})
test('energetic thrown objects advance a pane from healthy to flickering to broken', () => {
  expect(knotLightImpactEnergy(4.6, 10)).toBe(230)
  expect(isKnotLightDamageImpact(1.8, 10)).toBe(true)
  expect(isKnotLightDamageImpact(0.05, 10)).toBe(false)
  expect(isKnotLightDamageImpact(4.6, 1)).toBe(false)
  expect(isKnotLightDamageImpact(4.6, 10)).toBe(true)
  const damage = new KnotLightDamage(1)
  expect(damage.hit(0, 1.8, 1, 0, 1)).toBe(false)
  expect(damage.stage(0)).toBe(0)
  expect(damage.hit(0, 1.8, 10, 0, 1)).toBe(true)
  expect(damage.stage(0)).toBe(1)
  expect(damage.hit(0, 4.6, 10, knotLight.impactCooldown / 2, 2)).toBe(false)
  expect(damage.stage(0)).toBe(1)
  expect(damage.hit(0, 4.6, 10, knotLight.impactCooldown + 0.01, 1)).toBe(false)
  expect(damage.stage(0)).toBe(1)
  expect(damage.hit(0, 4.6, 10, knotLight.impactCooldown + 0.01, 2)).toBe(true)
  expect(damage.stage(0)).toBe(2)
  expect(damage.intensity(0, 10)).toBe(0)
  expect(damage.hit(0, 4.6, 10, 20, 3)).toBe(false)
})
test('damaged panes flicker chaotically from deterministic noise', () => {
  const first = Array.from({length: 240}, (_, index) => knotLightFlicker(73, index / 120))
  const repeat = Array.from({length: 240}, (_, index) => knotLightFlicker(73, index / 120))
  const other = Array.from({length: 240}, (_, index) => knotLightFlicker(74, index / 120))
  expect(repeat).toEqual(first)
  expect(other).not.toEqual(first)
  const flickerLevels = new Set(first.map(value => value.toFixed(4)))
  expect(flickerLevels.size).toBeGreaterThan(30)
  expect(knotLightFlicker(73, 0)).toBe(1)
  // It dims deeply now and then, yet never goes out, which only breaking does.
  expect(Math.min(...first)).toBeGreaterThan(0)
  expect(Math.min(...first)).toBeLessThan(0.6)
  expect(Math.max(...first)).toBeGreaterThan(0.9)
})
