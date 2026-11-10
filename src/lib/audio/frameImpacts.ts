import type {Voice} from 'procedural-audio'

import {clamp} from 'math'
import {noise, osc} from 'procedural-audio'

/** which part of a loose work strikes first */
export type FrameContact = 'corner' | 'edge' | 'flat'
/** how a kind of frame sounds when its work strikes something, shared by every frame of what it is made of */
export type FrameImpactSound = {
  /** the stretched canvas’ drum in Hz */
  drum: number
  gain: number
  /** the band of the knock’s click in Hz */
  knock: number
  /** the frame’s first resonances in Hz */
  modes: ReadonlyArray<number>
  /** how long the resonances ring, relative */
  ring: number
}

/** every sound a frame can make striking something, by the id frames name theirs by */
export const frameImpactSounds = {
  // gessoed and gilded wood, the sound of every frame that names none: bright, a little brittle
  gilt: {
    modes: [330, 810, 1490],
    knock: 1900,
    drum: 96,
    ring: 1,
    gain: 1,
  },
  // solid wood, like oak, walnut or ebony: deeper and rounder
  hardwood: {
    modes: [240, 590, 1180],
    knock: 1500,
    drum: 88,
    ring: 1.25,
    gain: 1.1,
  },
  // stone, metal and other heavy frames: a dull weight with a hard edge
  heavy: {
    modes: [170, 430, 960, 2650],
    knock: 2600,
    drum: 70,
    ring: 0.8,
    gain: 1.2,
  },
} as const satisfies Record<string, FrameImpactSound>
export type FrameImpactSoundId = keyof typeof frameImpactSounds

/** each resonance’s share of the level, from the lowest up */
const modeLevels = [0.7, 0.45, 0.25, 0.2]

/**
 * A framed work striking the floor or a wall at `speed` m/s: a corner knocks sharp with the frame’s resonances and the canvas’ drum, an edge knocks fuller, and a work falling flat slaps down on a cushion of air with its corners rattling after, all louder the harder it strikes.
 * `variation` (−1–1) detunes it a little, so strike after strike never sounds the same.
 */
export function frameImpactVoices(contact: FrameContact, speed: number, sound: FrameImpactSoundId = 'gilt', variation = 0): Array<Voice> {
  if (speed < 0.2) {
    return []
  }
  const profile: FrameImpactSound = frameImpactSounds[sound]
  // From 9 m/s on, as hard as a work thrown at a wall strikes, every strike sounds alike, which keeps the hardest within headroom.
  const strength = clamp(speed / 9, 0, 1)
  const level = (0.006 + 0.11 * strength ** 1.2) * profile.gain
  const pitch = 1 + variation * 0.04
  const voices: Array<Voice> = []
  const resonances = (share: number, length: number) => {
    for (const [index, mode] of profile.modes.entries()) {
      voices.push(osc(mode * pitch, Math.max(0.03, (length - index * 0.025) * profile.ring), level * share * modeLevels[index], {attack: 0.001}))
    }
  }
  if (contact === 'flat') {
    voices.push(
      noise(0.07, level * 2.2, {
        type: 'lowpass',
        frequency: 1600 * (0.6 + 0.4 * strength),
        endFrequency: 300,
        q: 0.5,
      }, {attack: 0.002}),
      osc(68 * pitch, 0.18, level * 0.9, {
        endFrequency: 46 * pitch,
        attack: 0.004,
      }),
    )
    resonances(0.3, 0.06)
    // The corners settle one after another.
    for (const [index, delay] of [0.03, 0.055, 0.09].entries()) {
      const share = 0.4 * 0.6 ** index
      voices.push(
        noise(0.004, level * share, {
          type: 'bandpass',
          frequency: profile.knock * 1.2,
          q: 1.4,
        }, {
          attack: 0.0005,
          delay: delay + variation * 0.004,
        }),
        osc(profile.modes[1] * 1.05 * pitch, 0.03, level * share * 0.4, {delay}),
      )
    }
    return voices
  }
  const edge = contact === 'edge'
  voices.push(noise(edge ? 0.009 : 0.006, level * (edge ? 1.7 : 1.4), {
    type: 'bandpass',
    frequency: profile.knock * pitch,
    endFrequency: profile.knock * 0.65 * pitch,
    q: 1.4,
  }, {attack: 0.0005}))
  resonances(edge ? 1.2 : 1, edge ? 0.14 : 0.11)
  voices.push(osc(profile.drum * 1.15 * pitch, edge ? 0.22 : 0.16, level * (edge ? 0.6 : 0.45), {
    endFrequency: profile.drum * pitch,
    attack: 0.002,
    delay: 0.003,
  }))
  return voices
}

/**
 * Which part of a work strikes first, by the contact’s normal in the frame’s own space, in which the work faces +z: its face or back where the normal runs nearly along z, a whole side where it runs nearly square to one of the work’s edges, else a corner.
 */
export function frameContact([x, y, z]: readonly [number, number, number]): FrameContact {
  const length = Math.hypot(x, y, z) || 1
  // Within 14° of its face: anything tipped further lands on whatever sticks out first.
  if (Math.abs(z) / length >= 0.97) {
    return 'flat'
  }
  const across = Math.hypot(x, y) || 1
  return Math.min(Math.abs(x), Math.abs(y)) / across < 0.25 ? 'edge' : 'corner'
}
