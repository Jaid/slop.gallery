import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 100_000,
    position: [0, 3, 3.78],
    rotation: Math.PI,
  },
  west_0: {
    wallId: 'west',
    ratio: '1:1',
    area: 100_000,
    position: [-3.78, 3, 1.8],
    rotation: Math.PI / 2,
  },
} satisfies Record<string, RoomPortraitSlot>
