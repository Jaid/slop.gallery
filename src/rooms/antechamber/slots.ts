import type {RoomPortraitSlot} from '../base/Room.ts'

import antechamber, {antechamberPavilionCenter} from '#src/lib/gallery/antechamber.ts'

const [originX, originZ] = antechamber.center
const [westX, westZ] = antechamberPavilionCenter('west')
const [eastX, eastZ] = antechamberPavilionCenter('east')
const [pavW, pavD] = antechamber.pavilion.size

export default {
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 100_000,
    position: [0, 3, 3.78],
    rotation: Math.PI,
  },
  // Centered on the west pavilion’s west wall, greeting visitors through the west arched neck.
  west_0: {
    wallId: 'west_west',
    ratio: '1:1',
    area: 40_000,
    position: [westX - pavW / 2 + 0.22 - originX, 2.35, westZ - originZ],
    rotation: Math.PI / 2,
    priority: 1,
  },
  // Centered on the east pavilion’s unbroken south wall.
  east_0: {
    wallId: 'east_south',
    ratio: '1:1',
    area: 40_000,
    position: [eastX - originX, 2.35, eastZ + pavD / 2 - 0.22 - originZ],
    rotation: Math.PI,
  },
} satisfies Record<string, RoomPortraitSlot>
