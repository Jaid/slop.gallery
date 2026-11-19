import type {Vec3} from 'math'

import {meteoriteCut} from './MeteoriteGeometry.ts'

/** the orbital sculpture hovering over Moonfall’s crater */
export const moonfallSculpture = {
  /** the middle of the meteorite, relative to the room’s origin */
  center: [0, 2.5, 0] satisfies Vec3,
  /** how large the meteorite is round */
  coreRadius: 0.7,
  /** how far in front of the meteorite’s sawn face the lamp glued to it shines, in meters, just outside the outermost band and its bead */
  lampDistance: 1.5,
}

/** Where the lamp glued to the front of the sculpture sits relative to the meteorite’s middle, out of its sawn face along the cut’s normal, before the meteorite turns it along. */
export const sculptureLampOffset = meteoriteCut.normal.clone().multiplyScalar(meteoriteCut.depth * moonfallSculpture.coreRadius + moonfallSculpture.lampDistance).toArray() satisfies Vec3
