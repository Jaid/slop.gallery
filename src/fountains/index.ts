import LimestoneFountain from './limestone/LimestoneFountain.ts'
import MarbleFountain from './marble/MarbleFountain.ts'

/** every fountain there is by its id */
export const fountains = {
  limestone: new LimestoneFountain,
  marble: new MarbleFountain,
} as const

/** the id of one of the fountains */
export type FountainId = keyof typeof fountains

export type {default as Fountain, FountainModel, FountainModelProps} from './base/Fountain.ts'
