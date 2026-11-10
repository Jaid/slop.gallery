import type {Voice} from 'procedural-audio'

import {noise, osc, scaleVoices} from 'procedural-audio'

/** how long the shimmer of a work dropped into the room swells, in seconds, before the work is there */
const landing = 0.38
/** how far apart works dropped together arrive, in seconds at least */
export const arrivalGap = 0.09

/**
 * A dropped image arriving as a work: a shimmer swells out of nothing for a third of a second and the canvas lands with a soft thump and a warm fifth, or, where it is `hung` right away, the shimmer swells until its hanging, which sounds for itself, slaps it onto its wall, where the fifth rings out.
 * `variation` (−1–1) tunes it a little apart, so works arriving one after another never sound alike. `swell` is how many seconds the shimmer swells before the work is there, a third of a second by default, as long as a hanging takes to strike its wall for a work slapped onto one.
 */
export default function arrivalVoices(hung: boolean, variation = 0, swell = landing): Array<Voice> {
  const pitch = 1 + variation * 0.02
  return scaleVoices([
    noise(swell + 0.04, 0.06, {
      type: 'bandpass',
      frequency: 1800,
      endFrequency: 7000,
      q: 1.3,
    }, {attack: swell}),
    osc(2637 * pitch, 0.12, 0.004, {delay: Math.max(0, swell - 0.1)}),
    osc(3136 * pitch, 0.1, 0.003, {delay: Math.max(0, swell - 0.05)}),
    ...hung ? [] : [
      osc(130, 0.1, 0.03, {
        endFrequency: 85,
        delay: swell,
      }),
      noise(0.05, 0.05, {
        type: 'lowpass',
        frequency: 1200,
        endFrequency: 400,
      }, {
        attack: 0.002,
        delay: swell,
      }),
    ],
    osc(659.25 * pitch, 0.55, 0.012, {
      attack: 0.01,
      delay: swell,
    }),
    osc(987.77 * pitch, 0.5, 0.008, {
      attack: 0.01,
      delay: swell + 0.03,
    }),
  ], 1.25)
}
