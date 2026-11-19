import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  // Over the middle of the paneled stretch west of the arch to the Vesper by the north-east corner.
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
  // Across from east_0, north of the vestibule’s arch by the south-west corner.
  west_0: {
    wallId: 'west',
    ratio: '1:1',
    area: 15_000,
    position: [-5.78, 3.15, -3],
    rotation: Math.PI / 2,
  },
} satisfies Record<string, RoomPortraitSlot>
