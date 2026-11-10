import type {Voice} from 'procedural-audio'

import {noise, osc, shiftVoices} from 'procedural-audio'

/**
 * An orb dropping down the throat of the alchemy machine’s sink into its iron body: the glass ticking against the brass, a hollow clonk as it lands inside and a low gulp sinking away under it.
 * `variation` (−1–1) detunes it a little, so no two sound alike.
 */
export function alchemySwallowVoices(variation = 0): Array<Voice> {
  const pitch = 1 + variation * 0.04
  return [
    noise(0.004, 0.05, {
      type: 'bandpass',
      frequency: 3400 * pitch,
      q: 1.4,
    }, {attack: 0.0004}),
    osc(2380 * pitch, 0.12, 0.006, {attack: 0.001}),
    // landing inside the body, a step lower
    osc(260 * pitch, 0.22, 0.03, {
      endFrequency: 190 * pitch,
      attack: 0.002,
      delay: 0.09,
    }),
    osc(520 * pitch, 0.12, 0.008, {
      endFrequency: 430 * pitch,
      delay: 0.09,
    }),
    noise(0.05, 0.03, {
      type: 'lowpass',
      frequency: 700,
    }, {delay: 0.09}),
    osc(150 * pitch, 0.5, 0.022, {
      endFrequency: 62 * pitch,
      attack: 0.04,
      delay: 0.12,
    }),
  ]
}

/**
 * The alchemy machine working on an orb for `duration` seconds: a low hum swelling in and out under a rumbling boil, with bubbles welling up at uneven intervals, never in a steady beat and never shrill.
 */
export function alchemyBrewVoices(duration: number, variation = 0): Array<Voice> {
  const pitch = 1 + variation * 0.03
  const voices: Array<Voice> = [
    osc(55 * pitch, duration, 0.03, {
      endFrequency: 62 * pitch,
      attack: duration * 0.35,
    }),
    osc(110 * pitch, duration * 0.9, 0.012, {
      endFrequency: 131 * pitch,
      attack: duration * 0.4,
    }),
    noise(duration, 0.05, {
      type: 'lowpass',
      frequency: 260,
      endFrequency: 520,
    }, {attack: duration * 0.5}),
  ]
  // Bubbles welling up, ever more often as it boils, at intervals of their own
  const gaps = [0.31, 0.23, 0.37, 0.17, 0.27, 0.13, 0.21, 0.11, 0.19, 0.09]
  let at = 0.25
  for (const [index, gap] of gaps.entries()) {
    if (at > duration - 0.15) {
      break
    }
    const bubble = (380 + (index * 137 + variation * 90) % 260) * pitch
    voices.push(...shiftVoices([osc(bubble, 0.07, 0.006 + index * 0.0007, {
      endFrequency: bubble * 1.6,
      attack: 0.004,
    })], at))
    at += gap * (1 + variation * 0.15)
  }
  return voices
}

/**
 * The alchemy machine’s cannon going off: a deep thump of the charge, a dull boom rolling away and a rush of air out of the barrel, all kept low so it booms instead of cracking.
 */
export function cannonVoices(variation = 0): Array<Voice> {
  const pitch = 1 + variation * 0.04
  return [
    osc(96 * pitch, 0.32, 0.05, {
      endFrequency: 38 * pitch,
      attack: 0.002,
    }),
    osc(180 * pitch, 0.12, 0.02, {
      endFrequency: 70 * pitch,
      attack: 0.001,
    }),
    noise(0.07, 0.11, {
      type: 'lowpass',
      frequency: 1100,
      endFrequency: 300,
    }, {attack: 0.001}),
    noise(0.6, 0.05, {
      type: 'lowpass',
      frequency: 520,
      endFrequency: 120,
    }, {
      attack: 0.01,
      delay: 0.03,
    }),
    // the barrel ringing on after it, low
    osc(240 * pitch, 0.5, 0.006, {
      attack: 0.003,
      delay: 0.01,
    }),
  ]
}
