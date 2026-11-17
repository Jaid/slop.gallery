import type {FountainId} from '#src/fountains/index.ts'
import type {Vec3} from './types.ts'

import {createFountain, fountains} from '#src/fountains/index.ts'
import {forcedFountain} from '#src/fountains/lib/forcedFountain.ts'

import {environmentRandom} from '../environmentSeed.ts'
import {environmentSeed} from '../gameSeed.ts'
import lobby from './lobby.ts'

/** where the Lobby’s fountain stands: the middle of its foot, in the middle of the Lobby, right under its middle chandelier */
export const lobbyFountainSpot: Vec3 = [0, 0, (lobby.northZ + lobby.southZ) / 2]
const fountainIds = Object.keys(fountains) as Array<FountainId>

/** The id of the fountain that stands in the Lobby in the environment of `seed`: every seed rolls one of the fountains there are, unless `?fountain` asks for one of them, `forced`. */
export function lobbyFountainId(seed: number, forced: FountainId | '' = forcedFountain): FountainId {
  return forced || environmentRandom(seed).makeChild(['lobby', 'fountain']).rollItem(fountainIds)
}

/** the fountain this game’s seed rolled for the Lobby, the only one built */
export const lobbyFountain = createFountain(lobbyFountainId(environmentSeed))
