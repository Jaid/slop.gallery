import type {ItemIngredient} from '#src/lib/gallery/fusion/FusionRecipe.ts'
import type {MoodId} from '#src/moods/index.ts'

import {environmentRandom} from '#src/lib/environmentSeed.ts'

import {transparentOrb} from '../transparent/TransparentOrb.ts'
import Orb from './Orb.ts'

/** An orb filled with a scene of its own, which contributes its prompt as an instruction and its frame, if it has one, to the fusion of a portrait it is thrown into, while the fusion’s portal shows its photograph, which lies in the orb’s folder. A success empties it of its scene, and its clear glass flips back out of the portal as a Transparent Orb. */
export default abstract class PromptOrb extends Orb {
  /** how many of its adjectives a prompt may name, one of which the environment seed picks */
  readonly adjectiveCounts: ReadonlyArray<number> = [3, 4, 5]
  /**
   * what the prompt describes the reworked image by, ordered so that neighboring adjectives in a prompt belong together; the environment seed picks as many entries as it picked of {@link adjectiveCounts}
   * Synonyms share an entry, of which a prompt names at most one.
   */
  abstract readonly adjectives: ReadonlyArray<ReadonlyArray<string> | string>
  /** what the image model is asked to do to the image, leading into the adjectives */
  abstract readonly change: string
  /** the orb’s glow, which tints the portal of the fusion and, made locally without AI, the image in place of its prompt */
  abstract readonly color: string
  /** the word that joins the last of the adjectives a prompt names to the others: `or` leaves the image model free to pick among them, `and` asks for all of them */
  readonly conjunction: string = 'or'
  abstract override readonly mood: MoodId
  /** the URL of an image of it, which the portal of its fusion shows; made in advance, as its glass takes seconds to compile for the studio a thrown prop is photographed in */
  abstract readonly photo: string
  /** the opening sentence of the prompt, which sets the scene for the image model */
  abstract readonly premise: string
  /** the clear glass the orb leaves once a success emptied it */
  override readonly remains = transparentOrb

  /** The orb contributes its prompt as an instruction, its frame and its effect, if it has them, and shows in the portal by its glow and its photograph. */
  override ingredient(seed: number): ItemIngredient {
    const orb = super.ingredient(seed)
    return {
      ...orb,
      contributions: [
        {
          kind: 'instruction',
          instruction: this.prompt(seed),
        },
        ...orb.contributions,
      ],
      glow: this.color,
      look: this.photo,
    }
  }

  /** the orb’s whole instruction to the image model in the environment of `seed`, sent verbatim along with the image: its premise and change, then 3 to 5 of its adjectives in their listed order, never two synonyms, the last one joined by its {@link conjunction} */
  prompt(seed: number) {
    const random = environmentRandom(seed).makeChild(['orb', this.id])
    const count = random.makeChild('count').rollItem(this.adjectiveCounts)
    const entries = random.makeChild('adjectives').rollItems(this.adjectives, count, {keepOrder: true})
    const adjectives = entries.map(entry => (typeof entry === 'string' ? entry : random.makeChild(['synonym', entry[0]]).rollItem(entry)))
    return `${this.premise}\n\nPlease edit this image and ${this.change} ${adjectives.slice(0, -1).join(', ')} ${this.conjunction} ${adjectives.at(-1)}.`
  }
}
