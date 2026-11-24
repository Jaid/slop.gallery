import type {Voice} from 'procedural-audio'

import {noise, osc} from 'procedural-audio'

import {placardLandings, placardQuarters} from '../gallery/PlacardRoll.ts'

/** E major pentatonic climbing from E5, the key the arrival of a work rings its fifth in */
const climb = [659.25, 739.99, 830.61, 987.77, 1108.73]
/** where it lands: E5, B5 and E6, each a little after the one before, and how loud */
const landing = [[659.25, 0.018], [987.77, 0.013], [1318.51, 0.01]] as const
const {bounce, slam} = placardLandings
/** the quarter turns of the spin before it slams back onto its wall */
const quarters = placardQuarters().filter(quarter => quarter.time < slam)
/** the half turns of the spin before it slams back, its face to the wall or back to the viewer */
const halves = quarters.filter((_, index) => index % 2 === 1)
/**
 * A placard rolling to show its new text (see `PlacardRoll`), timed to its motion: under a faint flutter of the card cutting the air at every quarter turn, a celesta plucks a note at every half turn, climbing the E major pentatonic, the notes spreading apart as the spin slows, the last right as the new text goes on, and lands on an open E chord as the card pats back onto its wall, with a grace note on the bounce.
 * A placard `width` meters wide flutters and pats lower the wider it is, a third of an octave per doubling over one 1 m wide, while the celesta keeps its key. `variation` (−1–1) tunes it a hair apart, so rolls never sound alike yet stay in tune with the arrival.
 */
export default function placardVoices({variation, width}: {
  variation: number
  width: number
}): Array<Voice> {
  const pitch = width ** -0.33
  const tune = 1 + variation * 0.006
  const flutter = 1 + variation * 0.04
  const fastest = quarters[0].speed
  return [
    ...quarters.map((quarter, index) => {
      const share = quarter.speed / fastest
      const next = quarters.at(index + 1)
      const length = Math.min(0.07, (next ? next.time - quarter.time : 0.1) * 1.3)
      return noise(length, 0.04 * share ** 1.3, {
        type: 'bandpass',
        frequency: (500 + 2300 * share) * pitch * flutter,
        endFrequency: (400 + 1600 * share) * pitch * flutter,
        q: 1.1,
      }, {
        attack: length * 0.45,
        delay: quarter.time - length * 0.45,
      })
    }),
    ...halves.slice(-climb.length).flatMap((half, index) => tine(climb[index] * tune, half.time, 0.016 + index * 0.001)),
    ...landing.flatMap(([frequency, volume], index) => tine(frequency * tune, slam + index * 0.012, volume, 1.2)),
    ...tine(1977.77 * tune, bounce, 0.006, 0.4),
    // the card patting onto its wall
    noise(0.04, 0.035, {
      type: 'lowpass',
      frequency: 1200,
      endFrequency: 300,
      q: 0.8,
    }, {
      attack: 0.0015,
      delay: slam,
    }),
    osc(200 * pitch, 0.05, 0.015, {
      endFrequency: 135 * pitch,
      attack: 0.002,
      delay: slam,
    }),
  ]
}

/** A celesta’s plucked tine: its tone, an octave and a metallic partial dying quickly, and the hammer’s click. */
function tine(frequency: number, time: number, volume: number, length = 0.6): Array<Voice> {
  return [
    osc(frequency, length, volume, {
      attack: 0.002,
      delay: time,
    }),
    osc(frequency * 2, length * 0.35, volume * 0.3, {
      attack: 0.001,
      delay: time,
    }),
    osc(frequency * 5.43, 0.05, volume * 0.12, {
      attack: 0.0005,
      delay: time,
    }),
    noise(0.003, volume * 1.2, {
      type: 'highpass',
      frequency: 5000,
    }, {
      attack: 0.0003,
      delay: time,
    }),
  ]
}
