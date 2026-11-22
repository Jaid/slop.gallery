import {describe, expect, test} from 'bun:test'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoColor, impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {blade, whorls} from '../../src/orbs/impasto/strokes.ts'
import {impastoOrb, orbRadius, paintOrb, promptOrbs, randomOrbs, transparentOrb} from '../../src/orbs/index.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Impasto Orb', () => {
  test('asks the image model for a digital impasto artwork of the work that keeps its content intact, every one of the traits it names', () => {
    for (let seed = 0; seed < 200; seed++) {
      const prompt = impastoOrb.prompt(seed)
      expect(prompt).toContain('Please edit this image and change it to a high-quality digital impasto artwork while keeping the original content intact.')
      // All of them, not one of them to pick.
      expect(prompt).toMatch(/ and [\w-]+(?: [\w-]+)?\.$/u)
      expect(prompt).not.toMatch(/ or [\w-]+(?: [\w-]+)?\.$/u)
    }
    // The traits the gallery asked for are all among its own.
    const named = impastoOrb.adjectives.flat()
    for (const trait of ['detailed', 'cohesive', 'atmospheric', 'tactile', 'bold']) {
      expect(named).toContain(trait)
    }
  })
  test('brings a frame and a party effect of its own, casts its own workshop mood, glows a color of its own and leaves a Transparent Orb', () => {
    expect(promptOrbs).toContain(impastoOrb)
    expect(choiceFrames(impastoOrb.frame)).toEqual(['impasto'])
    for (const frame of choiceFrames(impastoOrb.frame)) {
      expect(frames[frame]).toBeDefined()
    }
    expect(moods[impastoOrb.mood].ambience).not.toBe(moods[paintOrb.mood].ambience)
    expect(moods[impastoOrb.mood].title).toBeTruthy()
    expect(impastoOrb.partyEffect(1)).toBe('smears')
    expect(partyEffects.smears.id).toBe('smears')
    expect(impastoOrb.remains).toBe(transparentOrb)
    const glows = promptOrbs.filter(orb => orb !== impastoOrb).map(orb => orb.color)
    expect(glows).not.toContain(impastoOrb.color)
  })
  test('turns up on the Vesper’s pedestals like the friendly orbs', () => {
    expect(randomOrbs).toContain(impastoOrb)
  })
  test('every knife stroke of its frame’s crust stays within its own cell and the next along and across, all its frame’s material looks at', () => {
    const {across, along, halfWidth, length, lip, slant, squeezed, start, wander} = crustStrokes
    const reach = length[1] + lip
    const side = halfWidth[1] * (1 + squeezed)
    for (const angle of [slant - wander, slant, slant + wander]) {
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
      // The stroke runs forward and up out of where it starts, its sides reaching out across that way.
      const lowX = start[0] * along - sin * side
      const highX = start[1] * along + cos * reach + sin * side
      const lowY = start[0] * across - cos * side
      const highY = start[1] * across + sin * reach + cos * side
      expect(lowX).toBeGreaterThanOrEqual(0)
      expect(highX).toBeLessThan(along * 2)
      expect(lowY).toBeGreaterThanOrEqual(0)
      expect(highY).toBeLessThan(across * 2)
    }
  })
  test('its paints go by their order, each its own color', () => {
    expect(impastoOrder.map(impastoIndex)).toEqual(impastoOrder.map((_, index) => index))
    const colors = new Set(Object.values(impastoPaints))
    expect(colors.size).toBe(impastoOrder.length)
    expect(impastoColor).toBeFunction()
  })
  test('creates a glass material of its own for every orb, opaque to depth despite its transmission', () => {
    const first = impastoOrb.createMaterial({radius: orbRadius})
    const second = impastoOrb.createMaterial({radius: orbRadius})
    try {
      expect(first).toBeInstanceOf(ImpastoOrbMaterial)
      expect(first).not.toBe(second)
      expect(first.name).toBe('orb-impasto')
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
