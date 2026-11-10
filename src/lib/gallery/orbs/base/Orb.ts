import type {FrameChoice} from '#src/frames/lib/frameChoice.ts'
import type {IngredientContribution, ItemIngredient} from '#src/lib/gallery/fusion/FusionRecipe.ts'
import type OrbGlassMaterial from '#src/lib/materials/orb/base/OrbGlassMaterial.ts'
import type {OrbGlassOptions} from '#src/lib/materials/orb/base/OrbGlassMaterial.ts'
import type {MoodId} from '#src/moods/index.ts'
import type {PartyEffectId} from '#src/party_effects/index.ts'

import {pickFrame} from '#src/frames/lib/frameChoice.ts'

/**
 * A kind of orb: a glass ball, which is an ingredient of the fusion of a portrait it is thrown into, contributing whatever it contributes instead of a studio photograph of itself, and which a success uses up.
 * Its prop is `prop-orb-<id>`, and it lives in a folder of its own.
 */
export default abstract class Orb {
  /** the id of the party effect the orb contributes to the portal of its fusion, if any */
  readonly effect?: PartyEffectId
  /** the frame the orb contributes to a fusion, or several, of which every game picks one; without one, the room the result arrives in frames it */
  readonly frame?: FrameChoice
  abstract readonly id: string
  /** the id of the mood that comes over the world while the player holds the orb, if any */
  readonly mood?: MoodId
  /** the orb a success that used this one up leaves of it, which flips out of the portal after the result, if any */
  readonly remains?: Orb
  abstract readonly title: string

  get propId() {
    return `prop-orb-${this.id}`
  }

  /** the glass with whatever the orb holds inside, for a ball of the given radius */
  abstract createMaterial(options: OrbGlassOptions): OrbGlassMaterial

  /** the orb as an ingredient of a fusion in the environment of `seed`: it contributes its frame and its effect, if it has them, and is latched on with a ping of its glass */
  ingredient(seed: number): ItemIngredient {
    const contributions: Array<IngredientContribution> = []
    if (this.frame) {
      contributions.push({
        kind: 'frame',
        frame: pickFrame(seed, this.frame),
      })
    }
    if (this.effect) {
      contributions.push({
        kind: 'effect',
        effect: this.effect,
      })
    }
    return {
      contributions,
      latch: 'glass',
    }
  }
}
