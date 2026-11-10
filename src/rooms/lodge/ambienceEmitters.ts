import type {RoomAmbience} from '../base/Room.ts'

export default {
  // Just above the logs: 60 cm over the fire’s origin on its hearth.
  fire: {
    emitter: 'fire',
    position: [0, 0.84, 4.2],
  },
} satisfies Record<string, RoomAmbience>
