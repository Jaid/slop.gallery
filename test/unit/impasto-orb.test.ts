import {describe, expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoColor, impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {impastoPalette, impastoStrokes} from '../../src/orbs/impasto/strokes.ts'
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
    expect(moods[impastoOrb.mood].title).toBe('Impasto')
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
  test('keeps the padded box every stroke of its glass is marched in inside the glass, with orthonormal axes and paints of its palette', () => {
    expect(impastoStrokes.length).toBeGreaterThan(12)
    for (const {across, along, center, normal, pigment, radii} of impastoStrokes) {
      for (const axis of [along, across, normal]) {
        expect(axis.length()).toBeCloseTo(1, 9)
      }
      expect(along.dot(across)).toBeCloseTo(0, 9)
      expect(along.dot(normal)).toBeCloseTo(0, 9)
      expect(across.dot(normal)).toBeCloseTo(0, 9)
      expect(pigment).toBeGreaterThanOrEqual(0)
      expect(pigment).toBeLessThan(impastoPalette.length)
      for (const x of [-1.1, 1.1]) {
        for (const y of [-1.1, 1.1]) {
          for (const z of [-1.1, 1.1]) {
            const corner = new Vector3
            corner.copy(center).addScaledVector(along, x * radii[0]).addScaledVector(across, y * radii[1]).addScaledVector(normal, z * radii[2])
            expect(corner.length()).toBeLessThan(0.95)
          }
        }
      }
    }
  })
})
