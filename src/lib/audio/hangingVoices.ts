import type {FrameImpactSoundId} from './frameImpacts.ts'
import type {Voice} from './proceduralAudio.ts'

import {frameImpactVoices} from './frameImpacts.ts'
import {noise, osc, shiftVoices} from './proceduralAudio.ts'

/** how fast a work strikes its wall as its hanging slaps it there, in m/s, for the loudness of its strike */
const slapSpeed = 6

/**
 * A work slapped onto its wall as it hangs: the swing of the arm rising into the strike `impact` seconds after the work left the player’s hands, then the palm smacking the frame’s face, its stuff slapping down flat like a loose work falling flat, gilt bright, hardwood round and stone or metal dull, as `sound` says, the wall booming under the blow, deeper and heavier by the frame’s `mass` against one of 1.2 m square, and the frame rattling twice on its hook.
 * `variation` (−1–1) tunes it a little apart, so hanging after hanging never sounds alike.
 */
export default function hangingVoices({impact, mass, sound, variation}: {
  impact: number
  mass: number
  sound: FrameImpactSoundId
  variation: number
}): Array<Voice> {
  const tune = 1 + variation * 0.05
  const weight = mass ** 0.25
  const rattle = (delay: number, frequency: number, volume: number) => noise(0.02, volume, {
    type: 'bandpass',
    frequency: frequency * tune,
    q: 4,
  }, {
    attack: 0.0005,
    delay: impact + delay,
  })
  return [
    noise(impact, 0.022, {
      type: 'bandpass',
      frequency: 450,
      endFrequency: 2000,
      q: 0.9,
    }, {attack: impact * 0.85}),
    // the crack of the palm’s skin
    noise(0.012, 0.05, {
      type: 'highpass',
      frequency: 1500 * tune,
      q: 0.6,
    }, {
      attack: 0.0004,
      delay: impact,
    }),
    // the flesh of the palm under it
    noise(0.045, 0.04, {
      type: 'bandpass',
      frequency: 480 * tune,
      endFrequency: 260,
      q: 1.1,
    }, {
      attack: 0.001,
      delay: impact,
    }),
    ...shiftVoices(frameImpactVoices('flat', slapSpeed, sound, variation), impact),
    // the wall’s mass booming
    osc(86 * tune / weight, 0.26 * weight, 0.03 * weight, {
      endFrequency: 50 / weight,
      attack: 0.004,
      delay: impact,
    }),
    noise(0.16 * weight, 0.04 * weight, {
      type: 'lowpass',
      frequency: 340,
      endFrequency: 70,
      q: 0.7,
    }, {
      attack: 0.003,
      delay: impact,
    }),
    rattle(0.075, 3300, 0.03),
    rattle(0.15, 2900, 0.018),
  ]
}
