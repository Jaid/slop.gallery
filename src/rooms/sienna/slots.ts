import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  // West of the Vesper arch, halfway between it and the north-west corner.
  north_0: {
    wallId: 'north',
    ratio: '1:1',
    area: 15_000,
    position: [-1.7, 3.15, -5.78],
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
  // East of the vestibule arch, halfway between it and the south-east corner.
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 15_000,
    position: [2.3, 3.15, 5.78],
    rotation: Math.PI,
  },
  west_0: {
    wallId: 'west',
    ratio: '1:1',
    area: 15_000,
    position: [-5.78, 3.15, -3],
    rotation: Math.PI / 2,
  },
  west_1: {
    wallId: 'west',
    ratio: '1:1',
    area: 15_000,
    position: [-5.78, 3.15, 3],
    rotation: Math.PI / 2,
  },
} satisfies Record<string, RoomPortraitSlot>
