import type {Toss} from '../physics/throwMotion.ts'
import type {Voice} from 'procedural-audio'

import {clamp} from 'math'
import {noise, osc} from 'procedural-audio'

import {referenceMass, throwSpeed} from '../physics/throwMotion.ts'

/** the speed at which a throw’s whoosh is at its fullest, in m/s: a throw on the run */
const fullSpeed = 16

/**
 * The sound of a prop leaving the hand, by how it left (see `toss` of `throwMotion.ts`), heard where it left the hand.
 *
 * - A throw sounds the interaction tone falling from 130 Hz, as ever, a drop from 400 Hz; a jump shot’s rises instead, by how much of the jump went into it.
 * - Everything sounds lower the heavier it is, by a third of the octaves it weighs more than an orb, and higher the lighter: a pumpkin heaves down to about 0.75×, a leaf flicks up to 2.5×.
 * - The arm’s swish swells with how fast it leaves, louder, longer and brighter, from nothing at a standstill, so a drop on the move swishes too, a little.
 * - A heavy throw grunts with a low heave of the arm under it, a light one flicks with a dry tick, both as hard as it was thrown.
 * - A run-up cracks the swish open sharper and snaps through it, by how much of a sprint went into it.
 *
 * `variation` (−1–1) detunes it a little, so throw after throw never sounds the same.
 */
export default function tossVoices({drive, effort, mass, rise, throwing, velocity}: Toss, variation = 0): Array<Voice> {
  const speed = Math.hypot(...velocity)
  const pace = clamp(speed / fullSpeed, 0, 1.5)
  // How many octaves it weighs more than an orb, within reason: a leaf weighs nothing, a Knot is heavy.
  const heft = mass > 0 ? clamp(Math.log2(mass / referenceMass), -4, 2) : 0
  const pitch = 2 ** (-heft / 3) * (1 + variation * 0.02)
  const strength = clamp(effort / throwSpeed, 0, 1.4)
  const base = (throwing ? 130 : 400) * pitch * (1 + drive * 0.12)
  const voices: Array<Voice> = [
    osc(base, 0.28 + 0.08 * Math.min(pace, 1), throwing ? 0.05 + 0.012 * strength : 0.045, {endFrequency: base * (0.55 + 0.8 * rise)}),
  ]
  if (pace > 0.02) {
    // The swish of the arm and of the prop through the air: a band of noise gliding up through the throw, brighter the faster and the lighter, higher still on a jump shot.
    const band = 420 * Math.sqrt(pitch) * (0.8 + 0.5 * Math.min(pace, 1))
    const length = 0.09 + 0.17 * Math.min(pace, 1)
    voices.push(noise(length, 0.07 * Math.min(pace, 1.2) ** 1.3, {
      type: 'bandpass',
      frequency: band,
      endFrequency: band * (2.4 + 1.4 * rise),
      q: 0.7 + 1.1 * drive,
    }, {attack: length * (0.45 - 0.3 * drive)}))
  }
  if (!throwing) {
    return voices
  }
  if (heft > 0) {
    // The arm heaving something heavy
    voices.push(osc(92 * pitch, 0.13, 0.034 * heft / 2 * Math.min(strength, 1), {
      endFrequency: 58 * pitch,
      attack: 0.012,
    }))
  } else if (heft < -1) {
    // Flicking something light off the fingers
    voices.push(noise(0.018, 0.018 * clamp((-heft - 1) / 3, 0, 1) * (0.5 + 0.5 * Math.min(strength, 1)), {
      type: 'bandpass',
      frequency: 2600 * pitch ** 0.5,
      q: 1.4,
    }, {attack: 0.001}))
  }
  if (drive > 0.05) {
    // A throw on the run snaps as the arm whips through.
    voices.push(noise(0.014, 0.026 * drive * Math.min(pace, 1), {
      type: 'highpass',
      frequency: 3200,
      q: 0.6,
    }, {
      attack: 0.0015,
      delay: 0.05,
    }))
  }
  return voices
}
