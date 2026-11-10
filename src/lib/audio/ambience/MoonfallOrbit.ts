import type {Vec3} from '../../gallery/types.ts'
import type {NoiseBed, ToneBed} from 'ambience-emitter'

import AmbienceEmitter from 'ambience-emitter'

import roomOrigins from '../../gallery/layout.ts'

/** a low hum whose harmonics slowly beat against each other */
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 55,
    beat: 0.3,
    volume: 0.05,
    sway: [0.2, 0.3],
  },
  {
    frequency: 110,
    beat: 0.45,
    volume: 0.025,
    sway: [0.3, 0.5],
  },
  {
    frequency: 165,
    volume: 0.008,
    sway: [0.4, 0.7],
  },
]
/** a faint rumble under the hum */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 180,
    stages: 3,
    volume: 0.03,
    sway: [0.3, 0.5],
  },
]
const [originX, originY, originZ] = roomOrigins.moonfall

/** Moonfall’s orbital sculpture: a celestial hum floating over the crater, sounding from its core. */
export default class MoonfallOrbit extends AmbienceEmitter {
  /** sounds from `position`, by default the sculpture’s core, in `rooms`, by default only Moonfall */
  constructor(position: Vec3 = [originX, originY + 2.5, originZ], rooms: ReadonlyArray<string> = ['moonfall']) {
    super({
      id: 'moonfall-orbital_sculpture',
      title: 'Orbital sculpture',
      position,
      hearing: {
        near: 1.5,
        // still faintly audible from the top of the stairway, about 27 m away
        far: 32,
      },
      gain: 0.3,
      rooms,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override get tones() {
    return tones
  }
}
