import type {FloorRectangle} from './floors.ts'

import lobby from './lobby.ts'
import StairFlight from './stairs/StairFlight.ts'

export const antechamberSize = [8, 8] as const
export const antechamberZ = lobby.southZ + antechamberSize[1] / 2
const baySide = 6
const bayX = (antechamberSize[0] + baySide) / 2
export const stairHalls = {
  west: {
    center: [-bayX, antechamberZ],
    size: [baySide, baySide],
  },
  east: {
    center: [bayX, antechamberZ],
    size: [baySide, baySide],
  },
  // The little return beyond the west hall is still the Antechamber. Only its east door opens onto Moonfall: no line from the Lobby through the west arch can double back through that door.
  return: {
    center: [-bayX, antechamberZ + baySide / 2 + 2.5],
    size: [4, 5],
  },
} as const satisfies Record<string, FloorRectangle>
export const stairHallHeight = 4.6
export const moonfallThreshold = {
  x: stairHalls.return.center[0] + stairHalls.return.size[0] / 2,
  z: stairHalls.return.center[1] + 0.5,
}
const footX = bayX + baySide / 2
/** Down from the blind upper landing to the east hall; leaving a level tread at both doors keeps the casing clear. */
export const eastStair = new StairFlight('east', [footX + 8, 2.88, antechamberZ], [footX, 0, antechamberZ], 2.8, 16, 1.2, 0.4, 'antechamber')

const landings = Object.values(stairHalls)

export function stairHallFloor(x: number, z: number) {
  return landings.some(({center, size}) => Math.abs(x - center[0]) <= size[0] / 2 && Math.abs(z - center[1]) <= size[1] / 2) ? 0 : undefined
}
