import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  // Centered on the stretch of wall west of the arch.
  north_0: {
    wallId: 'north',
    ratio: '1:1',
    area: 15_000,
    position: [-2, 3.15, -5.78],
    rotation: 0,
  },
  east_0: {
    wallId: 'east',
    ratio: '1:1',
    area: 15_000,
    position: [5.78, 3.15, -3],
    rotation: -Math.PI / 2,
  },
  east_1: {
    wallId: 'east',
    ratio: '1:1',
    area: 15_000,
    position: [5.78, 3.15, 3],
    rotation: -Math.PI / 2,
  },
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 15_000,
    position: [3, 3.15, 5.78],
    rotation: Math.PI,
  },
  south_1: {
    wallId: 'south',
    ratio: '1:1',
    area: 15_000,
    position: [-3, 3.15, 5.78],
    rotation: Math.PI,
  },
  west_0: {
    wallId: 'west',
    ratio: '1:1',
    area: 15_000,
    position: [-5.78, 3.15, -3],
    rotation: Math.PI / 2,
  },
} satisfies Record<string, RoomPortraitSlot>
