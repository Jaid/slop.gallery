import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  // Over the middle of the paneling west of the arch to the Vesper by the north-east corner.
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
  // Over the middle of the paneling east of the arch into the vestibule by the south-west corner.
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 15_000,
    position: [3, 3.15, 5.78],
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
