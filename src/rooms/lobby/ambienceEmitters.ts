import type {RoomAmbience} from '../base/Room.ts'

export default {
  // About where a jet leaves the fountain that stands there; the fountain itself sounds from the mouth of its own tallest jet.
  fountain: {
    emitter: 'fountain',
    position: [0, 3, 0],
  },
} satisfies Record<string, RoomAmbience>
