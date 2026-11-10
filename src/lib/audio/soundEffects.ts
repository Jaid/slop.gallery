import type {SoundEffect} from './types.ts'
import type {AudioOutput} from 'procedural-audio'

import playVoices, {noise, osc} from 'procedural-audio'

import {playerSoundEffects} from './playerSoundEffects.ts'
import {switchSoundEffects} from './switchSoundEffects.ts'

export type {SoundEffect} from './types.ts'

export const soundEffects: Array<SoundEffect> = [
  {
    id: 'SFX-02',
    label: 'Bubble Pop',
    voices: [
      osc(410, 0.14, 0.042, {endFrequency: 115}),
      osc(160, 0.09, 0.02, {
        endFrequency: 72,
        delay: 0.025,
        type: 'triangle',
      }),
    ],
  },
  {
    id: 'SFX-03',
    label: 'Glass Tick',
    voices: [
      osc(2350, 0.12, 0.022, {endFrequency: 1860}),
      osc(3520, 0.095, 0.013, {
        endFrequency: 2750,
        delay: 0.008,
      }),
    ],
  },
  {
    id: 'SFX-04',
    label: 'Soft Confirm',
    voices: [
      osc(523.25, 0.16, 0.026),
      osc(783.99, 0.2, 0.028, {delay: 0.075}),
    ],
  },
  {
    id: 'SFX-06',
    label: 'Coin Spark',
    voices: [
      osc(987.77, 0.09, 0.021, {type: 'square'}),
      osc(1479.98, 0.11, 0.022, {
        delay: 0.055,
        type: 'square',
      }),
      osc(1975.53, 0.18, 0.018, {delay: 0.11}),
    ],
  },
  {
    id: 'SFX-07',
    label: 'Crystal Ping',
    voices: [
      osc(1318.51, 0.55, 0.022),
      osc(1977.77, 0.42, 0.015, {delay: 0.006}),
      osc(2637.02, 0.32, 0.01, {delay: 0.014}),
    ],
  },
  {
    id: 'SFX-08',
    label: 'Tiny Bell',
    voices: [
      osc(880, 0.72, 0.021),
      osc(1760, 0.54, 0.013, {delay: 0.004}),
      osc(2640, 0.4, 0.008, {delay: 0.01}),
    ],
  },
  {
    id: 'SFX-09',
    label: 'Chime Rise',
    voices: [
      osc(392, 0.18, 0.022),
      osc(523.25, 0.2, 0.022, {delay: 0.075}),
      osc(659.25, 0.22, 0.022, {delay: 0.15}),
      osc(783.99, 0.3, 0.024, {delay: 0.225}),
    ],
  },
  {
    id: 'SFX-14',
    label: 'Sonar Pulse',
    voices: [
      osc(659.25, 0.8, 0.025, {attack: 0.01}),
      osc(1318.51, 0.52, 0.009, {attack: 0.008}),
    ],
  },
  {
    id: 'SFX-23',
    label: 'Kick Knock',
    voices: [
      osc(165, 0.16, 0.042, {endFrequency: 49}),
      noise(0.045, 0.02, {
        type: 'lowpass',
        frequency: 980,
        endFrequency: 320,
      }),
    ],
  },
  {
    id: 'SFX-28',
    label: 'Water Drip',
    voices: [
      osc(1080, 0.13, 0.023, {endFrequency: 1640}),
      osc(1720, 0.16, 0.017, {
        endFrequency: 930,
        delay: 0.045,
      }),
    ],
  },
  {
    id: 'SFX-29',
    label: 'Spring Boing',
    voices: [
      osc(190, 0.48, 0.034, {
        endFrequency: 94,
        type: 'triangle',
      }),
      osc(380, 0.36, 0.016, {
        endFrequency: 188,
        delay: 0.01,
        type: 'triangle',
      }),
      osc(570, 0.24, 0.009, {
        endFrequency: 282,
        delay: 0.02,
      }),
    ],
  },
  ...Object.values(playerSoundEffects),
  {
    id: 'SFX-42',
    label: 'Toggle On',
    voices: [
      osc(180, 0.065, 0.018, {
        endFrequency: 120,
        type: 'triangle',
      }),
      osc(660, 0.13, 0.017, {
        delay: 0.035,
        endFrequency: 920,
      }),
    ],
  },
  {
    id: 'SFX-43',
    label: 'Toggle Off',
    voices: [
      osc(180, 0.065, 0.018, {
        endFrequency: 110,
        type: 'triangle',
      }),
      osc(720, 0.13, 0.016, {
        delay: 0.035,
        endFrequency: 390,
      }),
    ],
  },
  {
    id: 'SFX-44',
    label: 'Switch Click',
    voices: [
      noise(0.014, 0.03, {
        type: 'bandpass',
        frequency: 4200,
        endFrequency: 2600,
        q: 1.4,
      }, {attack: 0.001}),
      osc(1250, 0.03, 0.012, {
        attack: 0.001,
        endFrequency: 700,
        type: 'triangle',
      }),
      osc(210, 0.05, 0.016, {
        delay: 0.004,
        endFrequency: 140,
      }),
    ],
  },
  ...Object.values(switchSoundEffects),
]

const byId = new Map(soundEffects.map(effect => [effect.id, effect]))

export function playSoundEffect(sound: AudioOutput, id: string) {
  const effect = byId.get(id)
  if (!effect) {
    return false
  }
  playVoices(sound, effect.voices, {seed: id})
  return true
}
