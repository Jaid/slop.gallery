import type {FloorRectangle} from './floors.ts'
import type {Vec3} from './types.ts'

import {floorTile} from './floors.ts'
import roomOrigins from './layout.ts'
import {salonSouthZ} from './salon.ts'

/** a column pedestal carrying an orb in its holder */
export type VesperOrbPedestal = {
  /** the middle of its foot */
  position: Vec3
  /** its turn about y, which faces its holder’s front foot out from the middle of the circle the pedestals stand in */
  rotation: number
}

/** The Vesper’s floor plan, from the Forge’s south wall to the Sienna’s north wall’s line, the Banquet’s mirror image across the Lobby, and the height its ceiling springs from. */
export const vesper = {
  center: [roomOrigins.vesper[0], roomOrigins.vesper[2]],
  size: [12, 8 - salonSouthZ],
  height: 5.8,
} as const satisfies FloorRectangle & {height: number}

/** The circle the orb pedestals stand on in the Vesper’s north half: its middle on the floor plan, 5 m north of the room’s middle on the corner where four floor tiles meet, and its radius, in meters. */
export const vesperOrbCircle = {
  center: [vesper.center[0], vesper.center[1] - 2.5 * floorTile],
  radius: 3,
} as const
/** how many orb pedestals stand on the {@link vesperOrbCircle} */
const orbPedestalCount = 5

/** Five column pedestals evenly round the {@link vesperOrbCircle}, each carrying an orb, clockwise from its northernmost one. */
export const vesperOrbPedestals: ReadonlyArray<VesperOrbPedestal> = Array.from({length: orbPedestalCount}, (_, index) => {
  const {center: [centerX, centerZ], radius} = vesperOrbCircle
  // Clockwise from the north as seen from above, so that sin and cos give the offsets from the middle along x and −z.
  const turn = index / orbPedestalCount * Math.PI * 2
  const x = Math.sin(turn) * radius
  const z = -Math.cos(turn) * radius
  return {
    position: [centerX + x, 0, centerZ + z],
    rotation: Math.atan2(x, z),
  }
})
