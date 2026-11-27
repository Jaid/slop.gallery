import {describe, expect, test} from 'bun:test'

import {orbRadius, paintOrb} from '../../src/orbs/index.ts'
import RosetteOrbMaterial from '../../src/orbs/paint/RosetteOrbMaterial.ts'
import {blade, whorls} from '../../src/orbs/paint/whorls.ts'

describe('Paint Orb', () => {
  test('contributes cold-press rag to its fusion', () => {
    expect(paintOrb.ingredient(0).contributions).toContainEqual({
      kind: 'canvasMaterial',
      canvasMaterial: 'rag',
    })
  })
  test('creates a glass material of its own for every orb, opaque to depth despite its transmission', () => {
    const first = paintOrb.createMaterial({radius: orbRadius})
    const second = paintOrb.createMaterial({radius: orbRadius})
    try {
      expect(first).toBeInstanceOf(RosetteOrbMaterial)
      expect(first).not.toBe(second)
      expect(first.name).toBe('orb-rosette')
      expect(first.emissiveNode).toBeTruthy()
      expect(first.emissionIsTransmission).toBe(true)
      expect(first.depthWrite).toBe(true)
      expect(first.opacity).toBe(1)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
  test('keeps every whorl inside the glass and out of the others, all the way from heel to tip', () => {
    const tiers = whorls.toSorted((a, b) => a.depth - b.depth)
    for (const [i, tier] of tiers.entries()) {
      const {count, depth, loft, root, slope, tip} = tier
      expect(count).toBeInteger()
      expect(count).toBeGreaterThan(2)
      expect(loft).toBeGreaterThan(0)
      expect(root).toBeGreaterThan(0)
      expect(root).toBeLessThan(tip)
      for (const r of [root, tip]) {
        // Leave a visible rim even under the glass’s magnification.
        expect(Math.hypot(r, Math.abs(depth + slope * r) + loft)).toBeLessThan(0.74)
      }
      for (const other of tiers.slice(0, i)) {
        const from = Math.max(root, other.root)
        const to = Math.min(tip, other.tip)
        if (from <= to) {
          // Clearance is linear in radius, so its minimum over their shared annulus is at one of these endpoints.
          for (const r of [from, to]) {
            expect(depth + r * slope - loft).toBeGreaterThan(other.depth + r * other.slope + other.loft)
          }
        }
      }
    }
  })
  test('leaves an angular gutter even where a blade bows toward the next dab in its whorl', () => {
    expect(blade.wander).toBeWithin(0, 1)
    for (const halfWidth of [blade.heel + blade.variation, blade.heel - blade.variation - blade.taper]) {
      expect(halfWidth).toBeGreaterThan(0)
      expect(halfWidth + (1 - halfWidth) * blade.wander).toBeLessThan(1)
    }
  })
})
