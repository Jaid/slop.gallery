import {describe, expect, test} from 'bun:test'

import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {moods} from '../../src/moods/index.ts'
import {impastoOrb, orbRadius, orbs, promptOrbs, randomOrbs, transparentOrb} from '../../src/orbs/index.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('the Impasto Orb', () => {
  test('is registered among the orbs, prompt orbs and random orbs with its own mood, frames and party effect', () => {
    expect(impastoOrb.id).toBe('impasto')
    expect(impastoOrb.propId).toBe('prop-orb-impasto')
    expect(impastoOrb.title).toBe('Impasto Orb')
    expect(impastoOrb.mood).toBe('impasto')
    expect(moods.impasto.id).toBe('impasto')
    expect(impastoOrb.effect).toBe('daubs')
    expect(partyEffects.daubs.id).toBe('daubs')
    expect(choiceFrames(impastoOrb.frame)).toEqual(['impasto', 'palette'])
    expect(frames.impasto.title).toBe('Sculpted impasto')
    expect(impastoOrb.remains).toBe(transparentOrb)
    expect(orbs).toContain(impastoOrb)
    expect(promptOrbs).toContain(impastoOrb)
    expect(randomOrbs).toContain(impastoOrb)
  })
  test('generates a digital impasto prompt keeping the original content intact and covering all core qualities', () => {
    const seen = new Set<string>
    for (let seed = 0; seed < 200; seed++) {
      const prompt = impastoOrb.prompt(seed)
      expect(prompt).toContain('high-quality digital impasto artwork')
      expect(prompt).toContain('keeping the original content intact')
      expect(prompt).toContain(' and ')
      seen.add(prompt)
    }
    expect(seen.size).toBeGreaterThan(100)
    const combined = [...seen].join(' ')
    for (const quality of ['detailed', 'cohesive', 'atmospheric', 'tactile', 'bold']) {
      expect(combined).toContain(quality)
    }
  })
  test('creates its material and builds its fusion ingredient', () => {
    const material = impastoOrb.createMaterial({radius: orbRadius})
    try {
      expect(material.name).toBe('orb-impasto')
    } finally {
      material.dispose()
    }
    const ingredient = impastoOrb.ingredient(1)
    expect(ingredient.latch).toBe('glass')
    expect(ingredient.glow).toBe(impastoOrb.color)
    expect(ingredient.look).toBe(impastoOrb.photo)
    expect(ingredient.contributions).toContainEqual({
      kind: 'instruction',
      instruction: impastoOrb.prompt(1),
    })
    expect(ingredient.contributions).toContainEqual({
      kind: 'effect',
      effect: 'daubs',
    })
  })
})
