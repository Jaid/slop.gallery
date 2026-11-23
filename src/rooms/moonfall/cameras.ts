import type {RoomCamera} from '../base/Room.ts'

import {stairArrival} from './spawns.ts'

export default {
  overview: {
    position: [-13.818, 4.317, 9.831],
    aim: {
      yaw: -1.1259,
      pitch: -0.2956,
    },
    fov: 60,
    ratio: 16 / 9,
  },
  stairs: {
    // On the lower flight’s centerline, looking due west, so its walls frame the view symmetrically.
    position: [stairArrival[0], stairArrival[1] + 1.65, stairArrival[2]],
    aim: {
      yaw: Math.PI / 2,
      pitch: -0.35,
    },
    fov: 60,
    ratio: 16 / 9,
  },
  crater: {
    position: [9.996, 4.38, -4.697],
    aim: {
      yaw: 2.0069,
      pitch: -0.6808,
    },
    fov: 80,
    ratio: 16 / 9,
  },
  sculpture: {
    position: [-3.135, 3.121, -7.892],
    aim: {
      yaw: -2.7728,
      pitch: -0.0636,
    },
    fov: 30,
    ratio: 1,
    // The meteorite’s turn and the bands’ precession as they were when the view was picked, solved from where the view’s ray met the meteorite’s surface.
    frozenTime: 278.53,
  },
} satisfies Record<string, RoomCamera>
