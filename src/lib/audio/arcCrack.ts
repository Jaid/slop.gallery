import type {Vec3} from '../gallery/types.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from './EffectSound.ts'

/**
 * The crack of the strike that opens a fusion, on top of the strike’s own knock, from `point`, where it struck, and as hard as `strength` (0.55–1.2) says: a bolt of static discharging, with a sharp snap, crackling sparks dying away over a quarter second, a zap falling through the octaves and a sub thump rolling off into a low rumble, all in a dry room with a long, dark tail.
 * It cleans up after itself once it has rung out.
 */
export default function playArcCrack(output: AudioOutput, point: Vec3, strength: number) {
  const sound = new EffectSound(output, point, {
    brightness: 0.5,
    decay: 0.8,
    length: 2.4,
    wet: 0.3,
  })
  const {now} = sound
  sound.hiss(now, 0.025, {
    filter: {
      type: 'highpass',
      frequency: 2200,
    },
    volume: 0.15 * strength,
    attack: 0.0004,
  })
  for (let index = 0; index < 26; index++) {
    // Ever sparser, as the discharge dies away.
    const at = 0.25 * (index / 26) ** 1.8 + Math.random() * 0.01
    sound.hiss(now + 0.005 + at, 0.004 + Math.random() * 0.012, {
      filter: {
        type: 'bandpass',
        frequency: 2000 + Math.random() * 5000,
        q: 3,
      },
      volume: (0.07 - index * 0.0022) * strength,
      attack: 0.0006,
    })
  }
  sound.tone(now, 0.2, {
    frequency: 2600,
    end: 160,
    volume: 0.022 * strength,
    attack: 0.001,
    type: 'sawtooth',
    filter: {
      type: 'bandpass',
      frequency: 1800,
      end: 300,
      q: 1.5,
    },
  })
  sound.tone(now, 0.55, {
    frequency: 72,
    end: 30,
    volume: 0.12 * strength,
    attack: 0.002,
  })
  sound.hiss(now + 0.02, 1.1, {
    filter: {
      type: 'lowpass',
      frequency: 700,
      end: 110,
    },
    volume: 0.045 * strength,
    attack: 0.06,
  })
  sound.finish()
}
