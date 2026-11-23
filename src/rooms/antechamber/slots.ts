import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 100_000,
    position: [0, 3, 3.78],
    rotation: Math.PI,
  },
  west_wing_west_0: {
    wallId: 'west_wing_west',
    ratio: '1:1',
    area: 60_000,
    position: [-10.98, 2.6, 0],
    rotation: Math.PI / 2,
  },
  east_wing_south_0: {
    wallId: 'east_wing_south',
    ratio: '1:1',
    area: 60_000,
    position: [7.6, 2.6, 3.78],
    rotation: Math.PI,
  },
} satisfies Record<string, RoomPortraitSlot>
