import type {CanvasMaterialId} from '../../src/canvas_materials/lib/canvasMaterialIds.ts'
import type {FusionIngredient, IngredientContribution} from '../../src/lib/gallery/fusion/FusionRecipe.ts'

import {describe, expect, test} from 'bun:test'

import hsl from 'okhsl'

import {pickFrame} from '../../src/frames/lib/frameChoice.ts'
import FusionRecipe, {fusionInstruction, itemIngredient, maximumIngredients, minimumIngredients, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {promptOrbs, transparentOrb} from '../../src/orbs/index.ts'
import {pickEffect} from '../../src/party_effects/lib/effectChoice.ts'

const png = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
const image = new Blob([png], {type: 'image/png'})
const hung = portraitIngredient({
  title: 'The hung portrait',
  source: image,
})
/** an item with the contributions and nothing else */
const item = (title: string, ...contributions: Array<IngredientContribution>) => itemIngredient(title, {contributions})
/** a portrait with its canvas material, if any */
const portrait = (canvasMaterial?: CanvasMaterialId) => portraitIngredient({
  source: '/work.jxl',
  ...canvasMaterial ? {canvasMaterial} : {},
})
const material = (...ingredients: Array<FusionIngredient>) => {
  const recipe = new FusionRecipe(ingredients)
  return recipe.canvasMaterial
}
describe('fusion recipe', () => {
  test('has 2 to 4 ingredients, the first of them a portrait', () => {
    expect([minimumIngredients, maximumIngredients]).toEqual([2, 4])
    expect(() => new FusionRecipe([hung])).toThrow(RangeError)
    for (const count of [1, 2, 3]) {
      const recipe = new FusionRecipe([hung, ...Array.from({length: count}, (_, index) => item(`item ${index}`))])
      expect(recipe.ingredients).toHaveLength(count + 1)
    }
    expect(() => new FusionRecipe([hung, ...Array.from({length: 4}, () => item('item'))])).toThrow(RangeError)
    expect(() => new FusionRecipe([item('item'), hung])).toThrow(TypeError)
    // Portraits come after the first one, too.
    const portraits = new FusionRecipe([hung, portraitIngredient({
      title: 'A loose portrait',
      source: '/loose.jxl',
    })])
    expect(portraits.ingredients.map(ingredient => ingredient.kind)).toEqual(['portrait', 'portrait'])
    expect(portraits.unchanged).toBe(false)
  })
  test('leaves the hung portrait unchanged where its own image is the only contribution an image model could work with, like with the Transparent Orb', () => {
    expect(transparentOrb.ingredient(1)).toEqual({
      contributions: [],
      latch: 'glass',
    })
    const clear = new FusionRecipe([hung, itemIngredient(transparentOrb.title, transparentOrb.ingredient(1))])
    expect(clear.unchanged).toBe(true)
    expect(clear.looks).toEqual([image])
    expect(clear.glow).toBeUndefined()
    expect(clear.frame).toBeUndefined()
    // Neither a frame nor how an ingredient shows in the portal gives a model anything to do.
    const framed = new FusionRecipe([
      hung,
      {
        ...item('framed', {
          kind: 'frame',
          frame: 'classic',
        }),
        glow: hsl.integer(29.2, 100, 56.8),
        look: '/look.jxl',
      },
    ])
    expect(framed.unchanged).toBe(true)
    expect(framed.frame).toBe('classic')
    const prompted = new FusionRecipe([
      hung,
      item('prompt', {
        kind: 'instruction',
        instruction: 'Make it blue.',
      }),
    ])
    expect(prompted.unchanged).toBe(false)
    const photographed = new FusionRecipe([
      hung,
      item('photograph', {
        kind: 'image',
        image: Promise.resolve(image),
      }),
    ])
    expect(photographed.unchanged).toBe(false)
  })
  test('asks to fuse several images, followed by every instruction in the order of its ingredient, and sends the instructions alone for a single image', () => {
    const several = new FusionRecipe([
      hung,
      item('second', {
        kind: 'image',
        image: '/second.jxl',
      }),
      item('prompts', {
        kind: 'instruction',
        instruction: 'Make it blue.',
      }, {
        kind: 'instruction',
        instruction: 'Make it loud.',
      }),
    ])
    expect(several.text(2)).toBe(`${fusionInstruction}\n\nMake it blue.\n\nMake it loud.`)
    expect(several.handmade).toBe('collage')
    const single = new FusionRecipe([
      hung,
      item('prompt', {
        kind: 'instruction',
        instruction: 'Make it blue.',
      }),
    ])
    expect(single.text(1)).toBe('Make it blue.')
    expect(single.handmade).toBe('tint')
  })
  test('sends every contributed image in the order of its ingredient, waiting for those still in the making, and nothing of the looks', async () => {
    const photograph = Promise.withResolvers<Blob>()
    const recipe = new FusionRecipe([
      hung,
      item('photographed', {
        kind: 'image',
        image: photograph.promise,
      }),
      {
        ...item('orb', {
          kind: 'instruction',
          instruction: 'Make it blue.',
        }),
        look: '/orb.jxl',
      },
    ])
    expect(recipe.looks).toEqual([image, '/orb.jxl'])
    expect(recipe.pendingLooks).toEqual([photograph.promise])
    const content = recipe.content()
    photograph.resolve(new Blob([png], {type: 'image/png'}))
    const {images, text} = await content
    expect(images).toEqual([png, png])
    expect(text).toBe(`${fusionInstruction}\n\nMake it blue.`)
  })
  test('takes the first glow and the first contributed frame, and tints by hand only by glows standing in for instructions', () => {
    const ingredients: Array<FusionIngredient> = [
      hung,
      {
        ...item('plain glow'),
        glow: hsl.integer(142.5, 100, 84.4),
      },
      {
        ...item('Test Orb', {
          kind: 'frame',
          frame: 'tramp',
        }, {
          kind: 'instruction',
          instruction: 'Make it black.',
        }),
        glow: hsl.integer(0, 0, 0),
      },
      item('frame', {
        kind: 'frame',
        frame: 'coffer',
      }),
    ]
    const recipe = new FusionRecipe(ingredients)
    expect(recipe.glow).toBe(ingredients[1].glow)
    const black = new FusionRecipe([hung, ingredients[2]])
    expect(black.glow).toBe(0)
    expect(recipe.frame).toBe('tramp')
    expect(recipe.tints.map(tint => tint.title)).toEqual(['Test Orb'])
  })
  test('takes the first contributed canvas material, which gives an image model nothing to do', () => {
    const finish = (canvasMaterial: CanvasMaterialId) => item(canvasMaterial, {
      kind: 'canvasMaterial',
      canvasMaterial,
    })
    const plain = new FusionRecipe([hung, item('plain')])
    expect(plain.canvasMaterial).toBeUndefined()
    const recipe = new FusionRecipe([hung, item('plain'), finish('diamond-dust'), finish('linen')])
    expect(recipe.canvasMaterial).toBe('diamond-dust')
    const alone = new FusionRecipe([hung, finish('wax')])
    expect(alone.canvasMaterial).toBe('wax')
    expect(alone.unchanged).toBe(true)
    expect(alone.looks).toEqual([image])
  })
  test('takes the canvas material of the first portrait that has one, the hung one first, below any an item contributed', () => {
    expect(portrait('linen').contributions).toContainEqual({
      kind: 'canvasMaterial',
      canvasMaterial: 'linen',
    })
    expect(material(portrait('linen'), portrait('wax'))).toBe('linen')
    expect(material(portrait(), portrait('wax'))).toBe('wax')
    expect(material(portrait(), portrait())).toBeUndefined()
    const finished = item('orb', {
      kind: 'canvasMaterial',
      canvasMaterial: 'diamond-dust',
    })
    expect(material(portrait('linen'), portrait('wax'), finished)).toBe('diamond-dust')
    expect(material(portrait('linen'), item('plain'))).toBe('linen')
    // A material gives an image model nothing to do.
    const plain = new FusionRecipe([portrait('linen'), item('plain')])
    expect(plain.unchanged).toBe(true)
  })
  for (const orb of promptOrbs) {
    test(`the ${orb.title} supplies the result’s finish, the model’s prompt and the portal’s look and effect`, () => {
      const work = portraitIngredient({
        source: image,
        canvasMaterial: 'linen',
      })
      const recipe = new FusionRecipe([work, itemIngredient(orb.title, orb.ingredient(7))])
      expect(recipe.text(recipe.imageCount)).toBe(orb.prompt(7))
      expect(recipe.frame).toBe(pickFrame(7, orb.frame))
      expect(recipe.canvasMaterial).toBe(orb.canvasMaterial)
      expect(recipe.effects).toEqual([pickEffect(7, orb.effect)])
      expect(recipe.glow).toBe(orb.color)
      expect(recipe.looks).toEqual([image, orb.photo])
      expect(recipe.latches).toEqual(['charge', 'glass'])
    })
  }
  test('the intro latches every ingredient on by charging up, and an orb, even the Transparent Orb, with a ping of glass', () => {
    const recipe = new FusionRecipe([hung, item('prop'), itemIngredient('Transparent Orb', transparentOrb.ingredient(7))])
    expect(recipe.latches).toEqual(['charge', 'charge', 'glass'])
  })
})
