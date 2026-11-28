import {randomOrbs} from '#src/orbs/index.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'

/** One of each orb, in catalog order for the default environment and shuffled by seed otherwise. */
export function vesperOrbs(seed: number) {
  return isDefaultSeed(seed) ? randomOrbs : environmentRandom(seed).makeChild(['vesper', 'orbs']).shuffle(randomOrbs)
}
