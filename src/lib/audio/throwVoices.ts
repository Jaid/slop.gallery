import type {ItemMotion} from '../physics/itemMotion.ts'
import type {Voice} from 'procedural-audio'

import {noise, osc} from 'procedural-audio'

/** Air off the hand and a soft exertion, rather than a fixed UI chime: mass lowers the pitch, speed brightens the rush and upward motion stretches it. A moving drop is a quieter little swish. */
export default function throwVoices({mass, speed, velocity, throwing}: ItemMotion): Array<Voice> {
  const motion = Math.min(Math.hypot(...velocity) / 18, 1)
  const weight = Math.min(Math.log1p(mass) / Math.log(31), 1)
  const effort = throwing ? 0.55 + speed / 22 : 0.12 + motion * 0.3
  const duration = 0.07 + weight * 0.06 + motion * 0.05 + Math.min(Math.max(0, velocity[1]) / 10, 1) * 0.06
  const pitch = (1700 - weight * 1000) * (0.8 + motion * 0.6)
  return [
    noise(duration, 0.032 * effort, {
      type: 'bandpass',
      frequency: pitch,
      endFrequency: pitch * 0.35,
      q: 0.65,
    }, {attack: duration * 0.18}),
    osc(160 - weight * 75, duration * 0.7, 0.014 * effort, {
      type: 'triangle',
      endFrequency: 60 - weight * 25,
      attack: 0.008,
    }),
  ]
}
