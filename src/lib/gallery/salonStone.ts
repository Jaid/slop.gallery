import type {StoneId} from '#src/stones/index.ts'

import {forcedStone} from '#src/stones/lib/forcedStone.ts'
import {stoneIds} from '#src/stones/lib/stoneIds.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'
import {environmentSeed} from '../gameSeed.ts'

/** The id of the stone the Salon’s sculpture and its socket are cut from in the environment of `seed`: every seed rolls one of the stones there are, independently of the sculpture, but the default seed cuts them from the first, unless `?stone` asks for one of them, `forced`. */
export function salonStoneId(seed: number, forced: StoneId | '' = forcedStone): StoneId {
  if (forced) {
    return forced
  }
  if (isDefaultSeed(seed)) {
    return stoneIds[0]
  }
  return environmentRandom(seed).makeChild(['salon', 'stone']).rollItem(stoneIds)
}

/** the id of the stone this game’s seed rolled for the Salon’s sculpture and socket */
export const salonStone = salonStoneId(environmentSeed)
