import type {RoomPortraitSlot} from '../base/Room.ts'

// One for each ratio of the catalog, side by side on the north wall, 5 m and 2.5 m from the north-eastern corner, centered on one line 2 m over the floor.
export default {
  north_0: {
    wallId: 'north',
    ratio: '3:2',
    area: 15_000,
    position: [1, 2, -3.885],
    rotation: 0,
  },
  north_1: {
    wallId: 'north',
    ratio: '1:1',
    area: 15_000,
    position: [3.5, 2, -3.885],
    rotation: 0,
  },
} satisfies Record<string, RoomPortraitSlot>
