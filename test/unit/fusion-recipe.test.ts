import type {FusionIngredient, IngredientContribution} from '../../src/lib/gallery/fusion/FusionRecipe.ts'

import {describe, expect, test} from 'bun:test'

import {pickFrame} from '../../src/lib/frames/frameChoice.ts'
import FusionRecipe, {fusionInstruction, itemIngredient, maximumIngredients, minimumIngredients, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {promptOrbs, transparentOrb} from '../../src/lib/gallery/orbs/index.ts'

const png = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
const image = new Blob([png], {type: 'image/png'})
const hung = portraitIngredient({
  title: 'The hung portrait',
  source: image,
})
/** an item with the contributions and nothing else */
const item = (title: string, ...contributions: Array<IngredientContribution>) => itemIngredient(title, {contributions})
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
        glow: '#ff0000',
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
        glow: '#00ff00',
      },
      {
        ...item('Test Orb', {
          kind: 'frame',
          frame: 'lodge-tramp',
        }, {
          kind: 'instruction',
          instruction: 'Make it red.',
        }),
        glow: '#ff0000',
      },
      item('frame', {
        kind: 'frame',
        frame: 'cell-coffer',
      }),
    ]
    const recipe = new FusionRecipe(ingredients)
    expect(recipe.glow).toBe('#00ff00')
    expect(recipe.frame).toBe('lodge-tramp')
    expect(recipe.tints.map(tint => tint.title)).toEqual(['Test Orb'])
    expect(recipe.localDescription).toBe('Tinted by hand in the Test Orb’s glow.')
  })
  for (const orb of promptOrbs) {
    test(`the ${orb.title} contributes its prompt, its frame of the game and its effect, if it has them, shows by its glow and photograph and is latched on with a ping of glass`, () => {
      expect(orb.ingredient(7)).toEqual({
        contributions: [
          {
            kind: 'instruction',
            instruction: orb.prompt(7),
          },
          ...orb.frame ? [
            {
              kind: 'frame' as const,
              frame: pickFrame(7, orb.frame),
            },
          ] : [],
          ...orb.effect ? [
            {
              kind: 'effect' as const,
              effect: orb.effect,
            },
          ] : [],
        ],
        glow: orb.color,
        look: orb.photo,
        latch: 'glass',
      })
    })
  }
  test('the intro latches every ingredient on by charging up, and an orb, even the Transparent Orb, with a ping of glass', () => {
    const recipe = new FusionRecipe([hung, item('prop'), itemIngredient('Transparent Orb', transparentOrb.ingredient(7))])
    expect(recipe.latches).toEqual(['charge', 'charge', 'glass'])
  })
})
