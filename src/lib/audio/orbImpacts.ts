import type {FootstepSurface} from './playerSoundEffects.ts'
import type {Voice} from 'procedural-audio'

import {clamp} from 'math'
import {noise, osc} from 'procedural-audio'

/** what a glass orb strikes: a kind of ground, by what it sounds like underfoot, or another orb */
export type OrbImpactSurface = FootstepSurface | 'orb'

type SurfaceProfile = {
  /** the click of first contact: band center in Hz and level */
  click: readonly [frequency: number, level: number]
  /** a short burst of grit on rough stone */
  grit?: number
  /** the hollow knock of a wooden floor’s boards in Hz */
  knock?: ReadonlyArray<number>
  /** the glass ringing on: partials in Hz, their level and how long the first one rings */
  ring: readonly [partials: ReadonlyArray<number>, level: number, length: number]
  /** the body’s thump, gliding down: from and to in Hz and level */
  thump?: readonly [from: number, to: number, level: number]
}

/** marble, terrazzo and other hard, smooth ground */
const hard: SurfaceProfile = {
  thump: [150, 72, 1],
  click: [3800, 0.9],
  ring: [[2380, 3910, 6150], 0.5, 0.26],
}
const surfaces: Record<OrbImpactSurface, SurfaceProfile> = {
  generic: hard,
  stone: {
    ...hard,
    grit: 0.3,
  },
  hollow: {
    thump: [205, 118, 1.15],
    click: [2200, 0.6],
    knock: [430, 790],
    ring: [[2380, 3910], 0.3, 0.2],
  },
  fabric: {
    thump: [112, 64, 0.65],
    click: [900, 0.18],
    ring: [[], 0, 0],
  },
  glass: {
    thump: [172, 96, 0.8],
    click: [5200, 0.8],
    ring: [[1240, 2380, 2960, 3910], 0.62, 0.42],
  },
  orb: {
    click: [6500, 1.1],
    ring: [[2860, 4980, 7340], 1.25, 0.5],
  },
}

/**
 * A 1.8 kg glass orb striking `surface` at `speed` m/s along the contact’s normal: a thump of its weight, a click of first contact and the glass ringing on briefly, all louder and brighter the harder it hits. Rough stone adds grit, boards a hollow knock, carpet only thuds and two orbs clink like marbles.
 * Strength follows impact energy loosely (speed^1.25), so a nudge stays a tap and a throw cracks. `variation` (−1–1) detunes it a little, so strike after strike never sounds the same.
 */
export function orbImpactVoices(surface: OrbImpactSurface, speed: number, variation = 0): Array<Voice> {
  if (speed < 0.12) {
    return []
  }
  const profile = surfaces[surface]
  const strength = clamp(speed / 8, 0, 1.25)
  const level = 0.004 + 0.06 * strength ** 1.25
  const bright = 0.6 + 0.4 * Math.min(strength, 1)
  const pitch = 1 + variation * 0.03
  const voices: Array<Voice> = []
  if (profile.thump) {
    const [from, to, thumpLevel] = profile.thump
    voices.push(osc(from * pitch, 0.07 + 0.06 * strength, level * thumpLevel, {
      endFrequency: to * pitch,
      attack: 0.0015,
    }))
  }
  const [click, clickLevel] = profile.click
  voices.push(noise(0.004 + 0.004 * strength, level * clickLevel * 1.6, {
    type: 'bandpass',
    frequency: click * bright,
    endFrequency: click * bright * 0.7,
    q: 1.1,
  }, {attack: 0.0004}))
  const [partials, ringLevel, length] = profile.ring
  for (const [index, partial] of partials.entries()) {
    voices.push(osc(partial * pitch * (1 + variation * 0.01 * index), Math.max(0.03, (length - index * 0.05) * (0.6 + 0.4 * Math.min(strength, 1))), level * ringLevel * 0.5 ** index * (0.4 + 0.6 * Math.min(strength, 1)), {attack: 0.001}))
  }
  for (const [index, knock] of (profile.knock ?? []).entries()) {
    voices.push(osc(knock * pitch, 0.07 - index * 0.02, level * 0.35 * 0.6 ** index, {attack: 0.001}))
  }
  if (profile.grit) {
    voices.push(noise(0.025, level * profile.grit, {
      type: 'highpass',
      frequency: 5000,
      q: 0.5,
    }, {
      attack: 0.001,
      delay: 0.002,
    }))
  }
  return voices
}
