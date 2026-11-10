import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {PartyEffectId} from '#src/party_effects/index.ts'
import type {SizedImage} from '../ImageImporter.ts'
import type {Portrait} from '../types.ts'

import modelImage from '../../ai/modelImage.ts'
import {loadBlob} from '../actions.ts'
import {compositeImages, tintImage} from '../ImageImporter.ts'

/** Something an ingredient contributes to the fusion: an image the result is made of, an instruction to the image model, a frame the result wears or an effect the portal shows. */
export type IngredientContribution = {
  /** It may still be in the making, like an item’s studio photograph. */
  image: Blob | Promise<Blob> | string
  kind: 'image'
} | {
  /** sent to the image model verbatim */
  instruction: string
  kind: 'instruction'
} | {
  /** the frame design the result wears wherever it arrives, instead of the frame of the room it arrives in */
  frame: PortraitFrameId
  kind: 'frame'
} | {
  /** the id of a party effect, which the portal shows besides its own choreography, like ghosts escaping it as the result flips out; it gives an image model nothing to do */
  effect: PartyEffectId
  kind: 'effect'
}
/** how the intro’s ember latches an ingredient on, see `FusionSound`: like a magnetic clamp charging up, or, for a glass ball like an orb, the same ending in a ping of glass */
export type IngredientLatch = 'charge' | 'glass'
/** an item as an ingredient of a fusion: any number of contributions, none at all for the Transparent Orb, and how the portal shows it */
export type ItemIngredient = {
  contributions: ReadonlyArray<IngredientContribution>
  /** its glow, which tints the portal and, where the ingredient contributes instructions, stands in for them by tinting the result when it is made locally, without AI */
  glow?: string
  /** how the intro’s ember latches it on, by default charging up */
  latch?: IngredientLatch
  /** what the portal shows of the ingredient instead of its images, like an orb’s illustration made in advance; never part of the result */
  look?: string
}
/** an ingredient of a fusion: a portrait or an item */
export type FusionIngredient = ItemIngredient & {
  kind: 'item' | 'portrait'
  /** what it is called, like a portrait’s title or “Spook Orb” */
  title: string
}
/** the prompt of an image model call: the images in a format image models take, and the text */
export type ImagePrompt = {
  images: Array<Uint8Array>
  text: string
}

/** the fewest ingredients a fusion has */
export const minimumIngredients = 2
/** the most ingredients a fusion has */
export const maximumIngredients = 4
/** what the image model is asked to do when it gets several images to make one of, ahead of the instructions */
export const fusionInstruction = 'Please merge the provided images into a single result. It’s up to you to decide how to merge them. For example, if one image is a character and another one is a scene, you can place the character in the scene. If several images show a character, you could come up with a cool fusion of them or you could insert one character into another’s scene or you could show them together – whatever makes sense to you. Feel free to be creative and artistic and come up with a result that is funny or interesting or clever or mind-blowing'

/** A portrait as an ingredient, which contributes its image. */
export function portraitIngredient({source, title}: Pick<Portrait, 'source' | 'title'>): FusionIngredient {
  return {
    kind: 'portrait',
    title,
    contributions: [
      {
        kind: 'image',
        image: source,
      },
    ],
  }
}

/** An item called `title` as an ingredient, with its contributions and how the portal shows it. */
export function itemIngredient(title: string, ingredient: ItemIngredient): FusionIngredient {
  return {
    ...ingredient,
    kind: 'item',
    title,
  }
}

/**
 * A fusion’s ingredients and everything they contribute, gathered into what its result is made of. A fusion has {@link minimumIngredients} to {@link maximumIngredients} ingredients, each a portrait or an item; the first is always the hung portrait, whose portal it is and which the result replaces.
 * The recipe decides whether there is anything for an image model to do at all, writes the model’s prompt or makes the result locally, without AI, and picks the frame and the glow.
 */
export default class FusionRecipe {
  readonly ingredients: ReadonlyArray<FusionIngredient>

  constructor(ingredients: ReadonlyArray<FusionIngredient>) {
    if (ingredients.length < minimumIngredients || ingredients.length > maximumIngredients) {
      throw new RangeError(`A fusion has ${minimumIngredients} to ${maximumIngredients} ingredients, not ${ingredients.length}.`)
    }
    if (ingredients[0].kind !== 'portrait') {
      throw new TypeError('The first ingredient of a fusion is always a portrait.')
    }
    this.ingredients = ingredients
  }

  /** the ids of the party effects the portal shows, each once, in the order of their ingredients */
  get effects() {
    return [...new Set(this.contributionsOf('effect').map(contribution => contribution.effect))]
  }

  /** the frame contributed first, which the result wears wherever it arrives; without one, the room it arrives in frames it */
  get frame() {
    return this.contributionsOf('frame').at(0)?.frame
  }

  /** the glow of the first ingredient with one, which tints the portal; the portal’s own colors without one */
  get glow() {
    return this.ingredients.find(ingredient => ingredient.glow)?.glow
  }

  /** how a result made locally, without AI, is made: a collage of several images, or a single image tinted by the glows standing in for the instructions */
  get handmade() {
    return this.imageCount > 1 ? 'collage' : 'tint'
  }

  /** how many images are contributed */
  get imageCount() {
    return this.contributionsOf('image').length
  }

  /** the contributed instructions to the image model, in the order of their ingredients */
  get instructions() {
    return this.contributionsOf('instruction').map(contribution => contribution.instruction)
  }

  /** how the intro’s ember latches each ingredient on, in their order */
  get latches(): Array<IngredientLatch> {
    return this.ingredients.map(ingredient => ingredient.latch ?? 'charge')
  }

  /** how the description of a result made locally, without AI, tells how it was made */
  get localDescription() {
    const parts = this.imageCount > 1 ? ['A locally made cut-paper collage, joined with a little gold.'] : []
    for (const {title} of this.tints) {
      parts.push(`Tinted by hand in the ${title}’s glow.`)
    }
    return parts.join(' ')
  }

  /** what the portal shows of the ingredients right away, in their order: each one’s look, or its contributed images that are at hand already */
  get looks(): Array<Blob | string> {
    return this.ingredients.flatMap(({contributions, look}) => look ?? contributions.flatMap(contribution => (contribution.kind === 'image' && !(contribution.image instanceof Promise) ? [contribution.image] : [])))
  }

  /** the contributed images still in the making of ingredients without a look, which the portal shows once they are made */
  get pendingLooks(): Array<Promise<Blob>> {
    return this.ingredients.flatMap(({contributions, look}) => (look === undefined ? contributions.flatMap(contribution => (contribution.kind === 'image' && contribution.image instanceof Promise ? [contribution.image] : [])) : []))
  }

  /** the ingredients whose glow stands in for their instructions when the result is made locally, without AI */
  get tints() {
    return this.ingredients.filter((ingredient): ingredient is FusionIngredient & {glow: string} => Boolean(ingredient.glow) && ingredient.contributions.some(contribution => contribution.kind === 'instruction'))
  }

  /** whether the hung portrait’s own image is all there is for an image model to work with, no other image and no instruction: then no model is asked, and the portrait comes back out of the portal as it went in, only framed anew */
  get unchanged() {
    return this.imageCount <= 1 && !this.instructions.length
  }

  /** The image model’s prompt: every contributed image in the order of its ingredient, re-encoded where image models reject its format, and the text, which is the fusion instruction where there are several images, followed by the contributed instructions. */
  async content(): Promise<ImagePrompt> {
    const sources = await this.images()
    // Image models reject formats like JXL, which the default works come in.
    const images = await Promise.all(sources.map(async source => modelImage(await loadBlob(source))))
    return {
      images,
      text: this.text(images.length),
    }
  }

  /** The contributed images the result is made of, in the order of their ingredients, once all of them are made. */
  async images() {
    return Promise.all(this.contributionsOf('image').map(contribution => contribution.image))
  }

  /** Makes the result locally, without AI: a collage of the contributed images, tinted by every glow that stands in for instructions. Throws where there is nothing to make by hand, like an instruction without a glow. */
  async local(): Promise<SizedImage> {
    const sources = await this.images()
    let result = sources.length > 1 ? await compositeImages(sources) : undefined
    for (const {glow} of this.tints) {
      result = await tintImage(result?.image ?? sources[0], glow)
    }
    if (!result) {
      throw new Error('Nothing in this fusion can be made without AI.')
    }
    return result
  }

  /** the text of the image model’s prompt for `images` images */
  text(images: number) {
    return [...images > 1 ? [fusionInstruction] : [], ...this.instructions].join('\n\n')
  }

  /** every contribution of the kind, in the order of the ingredients */
  private contributionsOf<Kind extends IngredientContribution['kind']>(kind: Kind) {
    return this.ingredients.flatMap(ingredient => ingredient.contributions.filter((contribution): contribution is Extract<IngredientContribution, {kind: Kind}> => contribution.kind === kind))
  }
}
