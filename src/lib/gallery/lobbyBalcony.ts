import {wallFace} from './architectureDimensions.ts'
import lobby from './lobby.ts'

/** The east-side doorway leaves the Antechamber’s dome and its springing wall intact. */
export const balconyDoor = {
  x: 5.95,
  width: 2.5,
  bottom: 4.4,
  height: 7.25,
  rise: 0.55,
  profile: 'arch',
} as const

export const lobbyBalcony = {
  floorY: balconyDoor.bottom,
  slabDepth: 0.38,
  frontZ: lobby.southZ - 2.65,
  backZ: lobby.southZ,
  halfWidth: lobby.width / 2 - wallFace,
  guardHeight: 1.16,
  /** the new foot of the south lunette, above the balcony doorway’s archivolt */
  wallTop: 7.6,
} as const

export function lobbyBalconyFloor(x: number, z: number) {
  if (Math.abs(x) <= lobbyBalcony.halfWidth && z >= lobbyBalcony.frontZ && z <= lobbyBalcony.backZ) {
    return lobbyBalcony.floorY
  }
}

/** The slab and the narrow continuous collision guard that backs the open grille. */
export const balconyDeck = {
  position: [0, lobbyBalcony.floorY - lobbyBalcony.slabDepth / 2, (lobbyBalcony.frontZ + lobbyBalcony.backZ) / 2],
  size: [lobbyBalcony.halfWidth * 2, lobbyBalcony.slabDepth, lobbyBalcony.backZ - lobbyBalcony.frontZ],
} as const
export const balconyGuard = {
  position: [0, lobbyBalcony.floorY + lobbyBalcony.guardHeight / 2, lobbyBalcony.frontZ + 0.09],
  size: [lobbyBalcony.halfWidth * 2, lobbyBalcony.guardHeight, 0.16],
} as const
