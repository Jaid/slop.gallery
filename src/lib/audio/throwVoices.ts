import type {ItemLaunch} from '../physics/itemLaunch.ts'
import type {Voice} from 'procedural-audio'

import {noise, osc} from 'procedural-audio'

/** Air off the arm and a soft grip release: faster launches are brighter and louder, weight lowers and lengthens the sound and an upward lob lifts its sweep. Drops get only a quiet rustle, not a full throwing cue. */
export default function throwVoices({mass, velocity, throwing}: Pick<ItemLaunch, 'mass' | 'throwing' | 'velocity'>): Array<Voice> {
  const speed = Math.hypot(...velocity)
  const strength = Math.min(1, speed / 20)
  const weight = Math.min(1, Math.log1p(mass) / Math.log(21))
  const lift = Math.max(-1, Math.min(1, velocity[1] / Math.max(1, speed)))
  const duration = (throwing ? 0.13 : 0.065) + weight * 0.12
  const volume = (throwing ? 0.014 : 0.004) + strength * (throwing ? 0.045 : 0.012)
  const pitch = (650 + strength * 1900) / (1 + weight * 1.5)
  return [
    noise(duration, volume, {
      type: 'bandpass',
      frequency: pitch,
      endFrequency: pitch * (0.45 + (lift + 1) * 0.3),
      q: 0.8,
    }, {attack: duration * 0.25}),
    osc(170 / (1 + weight), duration * 0.6, volume * 0.35, {
      endFrequency: 70 / (1 + weight),
      attack: 0.006,
    }),
  ]
}
