import type {RoomAmbience} from '../base/Room.ts'

import FountainAmbience from '#src/lib/audio/ambience/Fountain.ts'

export default {
  // About where a jet leaves the fountain that stands there; the fountain itself sounds from the mouth of its own tallest jet.
  fountain: {
    emitter: FountainAmbience,
    position: [0, 3, 0],
  },
} satisfies Record<string, RoomAmbience>
