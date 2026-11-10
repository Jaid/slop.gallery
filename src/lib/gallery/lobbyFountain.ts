import type {Vec3} from './types.ts'

import {fountains} from '#src/fountains/index.ts'

import lobby from './lobby.ts'

/** where the Lobby’s fountain stands: the middle of its foot, in the middle of the Lobby, right under its middle chandelier */
export const lobbyFountainSpot: Vec3 = [0, 0, (lobby.northZ + lobby.southZ) / 2]
/** how far from its axis the Lobby keeps clear for its fountain, in meters: as far as the widest fountain there is reaches */
export const lobbyFountainReach = Math.max(...Object.values(fountains).map(fountain => fountain.radius))
/** the fountain that stands in the Lobby */
export const lobbyFountain = fountains.marble
