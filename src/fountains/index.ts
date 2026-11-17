import type Fountain from './base/Fountain.ts'

import LimestoneFountain from './limestone/LimestoneFountain.ts'
import MarbleFountain from './marble/MarbleFountain.ts'

/**
 * Every kind of fountain there is by its id, unbuilt, so only whichever one stands somewhere becomes a fountain.
 * The order counts: seeds roll them by their place in it, and the first one stands wherever the default seed asks for one.
 */
export const fountains = {
  marble: MarbleFountain,
  limestone: LimestoneFountain,
} as const

/** the id of one of the fountains */
export type FountainId = keyof typeof fountains

/** Builds the fountain that goes by `id`. */
export function createFountain(id: FountainId): Fountain {
  const FountainClass = fountains[id]
  return new FountainClass
}

export type {default as Fountain, FountainModel, FountainModelProps} from './base/Fountain.ts'
