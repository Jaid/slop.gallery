import {describe, expect, test} from 'bun:test'

import {flavorSteering, steeredOrb} from '../../src/lib/gallery/alchemy/steering.ts'
import {paletteKnife} from '../../src/lib/gallery/curios/index.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {moods} from '../../src/moods/index.ts'
import DollopsOrbMaterial from '../../src/orbs/impasto/DollopsOrbMaterial.ts'
import {impastoOrb, orbRadius, paintOrb, promptOrbs, transparentOrb} from '../../src/orbs/index.ts'

describe('the Impasto Orb', () => {
  test('every prompt turns the work into a high-quality digital impasto and holds its content fast, whatever adjectives the seed rolls', () => {
    for (let seed = 0; seed < 200; seed++) {
      const prompt = impastoOrb.prompt(seed)
      expect(prompt.startsWith(impastoOrb.premise)).toBe(true)
      expect(prompt).toContain('Please edit this image and change it to a high-quality digital impasto artwork while keeping the original content intact')
      expect(prompt).toContain('the same subject, composition, poses, faces, colors and lighting, with nothing added, removed or rearranged')
      expect(prompt).toContain('thick sculptural paint laid on with a palette knife – raised ridges, peaks, grooves and broken edges catching raking light')
      expect(prompt).toContain('The impasto should be ')
    }
    // The traits the orb is named for are among those a prompt can name, and all of them are asked for at once.
    const pool = impastoOrb.adjectives.flat()
    for (const trait of ['detailed', 'cohesive', 'atmospheric', 'tactile', 'bold']) {
      expect(pool).toContain(trait)
    }
    expect(impastoOrb.conjunction).toBe('and')
  })
  test('it is its own orb beside the Paint Orb, not a second helping of it', () => {
    expect(impastoOrb.id).toBe('impasto')
    expect(impastoOrb.title).toBe('Impasto Orb')
    expect(impastoOrb.propId).toBe('prop-orb-impasto')
    expect(promptOrbs).toContain(impastoOrb)
    for (const seed of [0, 1, 7, 42, 977]) {
      expect(impastoOrb.prompt(seed)).not.toBe(paintOrb.prompt(seed))
    }
    expect(impastoOrb.color).not.toBe(paintOrb.color)
    expect(impastoOrb.mood).not.toBe(paintOrb.mood)
    expect(impastoOrb.effect).not.toBe(paintOrb.effect)
    expect(impastoOrb.frame).not.toEqual(paintOrb.frame)
    expect(impastoOrb.photo).not.toBe(paintOrb.photo)
    const colors = promptOrbs.map(orb => orb.color)
    const distinct = new Set(colors)
    expect(distinct.size).toBe(colors.length)
  })
  test('thrown into a portrait it contributes its prompt, a painter’s frame and its smears, and a success leaves its clear glass', () => {
    const ingredient = impastoOrb.ingredient(7)
    expect(ingredient.contributions.map(contribution => contribution.kind)).toEqual(['instruction', 'frame', 'effect'])
    expect(ingredient.contributions[0]).toEqual({
      kind: 'instruction',
      instruction: impastoOrb.prompt(7),
    })
    expect(impastoOrb.frame).toEqual(['palette', 'impressionist'])
    expect(ingredient.contributions[2]).toEqual({
      kind: 'effect',
      effect: 'impasto',
    })
    expect(ingredient.glow).toBe(impastoOrb.color)
    expect(ingredient.look).toBe(impastoOrb.photo)
    expect(ingredient.latch).toBe('glass')
    expect(impastoOrb.remains).toBe(transparentOrb)
    const recipe = new FusionRecipe([
      portraitIngredient({
        title: 'The hung portrait',
        source: '/hung.jxl',
      }),
      itemIngredient(impastoOrb.title, ingredient),
    ])
    expect(recipe.unchanged).toBe(false)
    expect(recipe.text(1)).toBe(impastoOrb.prompt(7))
    expect(recipe.effects).toEqual(['impasto'])
    expect(recipe.localDescription).toBe('Tinted by hand in the Impasto Orb’s glow.')
  })
  test('holding it casts its own mood, whose loop sounds the knife at work', () => {
    expect(impastoOrb.mood).toBe('impasto')
    const mood = moods.impasto
    expect(mood.id).toBe('impasto')
    expect(mood.title).toBe('Impasto')
    const {ambience: Ambience} = mood
    const ambience = new Ambience
    expect(ambience.id).toBe('mood-impasto')
    expect(ambience.title).toBe('Impasto')
  })
  test('its glass is filled with dollops of its own', () => {
    const material = impastoOrb.createMaterial({radius: orbRadius})
    try {
      expect(material).toBeInstanceOf(DollopsOrbMaterial)
      expect(material.name).toBe('orb-impasto')
      expect(material.emissionIsTransmission).toBe(true)
    } finally {
      material.dispose()
    }
  })
  test('the palette knife in the Salon calls it up in the Forge, renewably, like the other magic items call up theirs', () => {
    expect(paletteKnife.room).toBe('salon')
    expect(flavorSteering.get(paletteKnife.propId)).toBe(impastoOrb)
    expect(steeredOrb(`${paletteKnife.propId}-2`)).toBe(impastoOrb)
    expect(steeredOrb('prop-painting-set')).toBe(paintOrb)
  })
})
