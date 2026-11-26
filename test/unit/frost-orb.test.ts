import {expect, test} from 'bun:test'

import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {vesperOrbs} from '../../src/lib/gallery/vesperOrbs.ts'
import {moods} from '../../src/moods/index.ts'
import FrostOrbMaterial from '../../src/orbs/frost/FrostOrbMaterial.ts'
import {frostOrb, orbRadius, promptOrbs, transparentOrb} from '../../src/orbs/index.ts'

test('a discoverable Frost Orb edits the hung subject; its own crystal is a portal look, not an image-model input', async () => {
  expect(vesperOrbs(1).some(({orb}) => orb === frostOrb)).toBe(true)
  expect(promptOrbs).toContain(frostOrb)
  const source = '/portrait.jxl'
  const recipe = new FusionRecipe([portraitIngredient({source}), itemIngredient(frostOrb.title, frostOrb.ingredient(1))])
  expect(recipe.unchanged).toBe(false)
  expect(await recipe.images()).toEqual([source])
  expect(recipe.looks).toEqual([source, frostOrb.photo])
  expect(recipe.text(1)).toBe(frostOrb.prompt(1))
  expect(recipe.text(1)).toContain('bring a blizzard through the picture')
  expect(recipe.tints[0]?.finishTint).toBeFunction()
  expect(recipe.effects).toEqual(['flurry'])
  expect(recipe.frame).toBe('acrylic')
  expect(frostOrb.remains).toBe(transparentOrb)
  expect(moods[frostOrb.mood].ambience).toBeDefined()
  const glass = frostOrb.createMaterial({radius: orbRadius})
  try {
    expect(glass).toBeInstanceOf(FrostOrbMaterial)
    expect(glass.emissionIsTransmission).toBe(true)
    expect(glass.depthWrite).toBe(true)
  } finally {
    glass.dispose()
  }
})
