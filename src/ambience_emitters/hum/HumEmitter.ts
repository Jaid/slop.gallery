import type {EmitterPlacement} from '../lib/EmitterPlacement.ts'
import type {NoiseBed, ToneBed} from 'ambience-emitter'

import AmbienceEmitter from 'ambience-emitter'

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

/** A celestial hum, like that of Moonfall’s orbital sculpture floating over the crater, which sounds from its core: held tones that slowly beat against each other over a faint rumble. */
export default class HumEmitter extends AmbienceEmitter {
  constructor({id, position, rooms}: EmitterPlacement) {
    super({
      id,
      title: 'Celestial hum',
      position,
      hearing: {
        near: 1.5,
        // Moonfall’s is still faintly audible from the top of its stairway, about 27 m away.
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
