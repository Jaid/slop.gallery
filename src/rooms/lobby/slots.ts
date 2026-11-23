import type {RoomPortraitSlot} from '../base/Room.ts'

export default {
  north_0: {
    wallId: 'north',
    ratio: '2:3',
    area: 30_000,
    position: [-3.6, 2.7, -19.78],
    rotation: 0,
  },
  north_1: {
    wallId: 'north',
    ratio: '2:3',
    area: 30_000,
    position: [3.6, 2.7, -19.78],
    rotation: 0,
  },
  east_0: {
    wallId: 'east',
    ratio: '2:3',
    area: 30_000,
    priority: 100,
    position: [7.78, 2.7, 9.2],
    rotation: -Math.PI / 2,
  },
  west_0: {
    wallId: 'west',
    ratio: '2:3',
    area: 30_000,
    priority: 100,
    position: [-7.78, 2.7, 9.2],
    rotation: Math.PI / 2,
  },
  south_0: {
    wallId: 'south',
    ratio: '1:1',
    area: 30_000,
    position: [4.6, 2.35, 19.78],
    rotation: Math.PI,
  },
  south_1: {
    wallId: 'south',
    ratio: '1:1',
    area: 30_000,
    position: [-4.6, 2.35, 19.78],
    rotation: Math.PI,
  },
  extension_east_0: {
    wallId: 'extension_east',
    ratio: '3:2',
    area: 30_000,
    priority: 100,
    position: [7.78, 2.7, 0],
    rotation: -Math.PI / 2,
  },
  extension_west_0: {
    wallId: 'extension_west',
    ratio: '3:2',
    area: 30_000,
    priority: 100,
    position: [-7.78, 2.7, 0],
    rotation: Math.PI / 2,
  },
} satisfies Record<string, RoomPortraitSlot>
