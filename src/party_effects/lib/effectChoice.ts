import type {PartyEffectId} from '../index.ts'

import {environmentRandom} from '#src/lib/environmentSeed.ts'

/** the party effects an orb brings: one, or several, of which {@link pickEffect} draws one */
export type PartyEffectChoice = PartyEffectId | ReadonlyArray<PartyEffectId>

/** Every party effect of the choice. */
export function choiceEffects(choice: PartyEffectChoice): ReadonlyArray<PartyEffectId> {
  return typeof choice === 'string' ? [choice] : choice
}

/** The one party effect of the choice to play in the game of `seed`, drawn by the seed among the effects of a choice of several, once for the whole game. Every choice draws on its own. */
export function pickEffect(seed: number, choice: PartyEffectChoice): PartyEffectId {
  if (typeof choice === 'string') {
    return choice
  }
  return environmentRandom(seed).makeChild(['party-effect', ...choice]).rollItem(choice)
}
