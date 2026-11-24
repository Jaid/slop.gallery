import type {OscillatorVoice, Voice} from 'procedural-audio'

import {expect, test} from 'bun:test'

import placardVoices from '../../src/lib/audio/placardVoices.ts'
import {placardLandings, placardQuarters, placardRoll} from '../../src/lib/gallery/PlacardRoll.ts'

const options = {
  variation: 0,
  width: 1.2,
}
/** the celesta’s tones, without their octaves and partials */
const notes = (voices: ReadonlyArray<Voice>) => voices.filter((voice): voice is OscillatorVoice => voice.kind === 'oscillator' && voice.frequency > 600 && voice.frequency < 2000 && voice.duration >= 0.5)/** the low knock of the card patting onto its wall */
const pat = (voices: ReadonlyArray<Voice>) => voices.find((voice): voice is OscillatorVoice => voice.kind === 'oscillator' && voice.delay === placardLandings.slam && voice.frequency < 300)!
test('climbs a note at every half turn of the spin, the last as the new text goes on', () => {
  const {slam} = placardLandings
  const spin = notes(placardVoices(options)).filter(note => note.delay! < slam)
  const halves = placardQuarters().filter((quarter, index) => index % 2 === 1 && quarter.time < slam)
  expect(spin.map(note => note.delay)).toEqual(halves.map(half => half.time))
  expect(spin.map(note => note.frequency)).toEqual(spin.map(note => note.frequency).toSorted((a, b) => a - b))
  expect(spin.at(-1)!.delay).toBe(placardQuarters()[9].time)
})
test('lands on an open E chord as it slams back onto its wall and rings a grace note on the bounce', () => {
  const {bounce, slam} = placardLandings
  const landed = notes(placardVoices(options)).filter(note => note.delay! >= slam && note.delay! < bounce)
  expect(landed.map(note => Math.round(note.frequency))).toEqual([659, 988, 1319])
  expect(landed[0].delay).toBe(slam)
  expect(placardVoices(options).some(voice => voice.delay === bounce)).toBe(true)
})
test('flutters at every quarter turn before it slams, louder the faster it turns', () => {
  const flutter = placardVoices(options).filter(voice => voice.kind === 'noise' && voice.filter.type === 'bandpass')
  const quarters = placardQuarters().filter(quarter => quarter.time < placardLandings.slam)
  expect(flutter).toHaveLength(quarters.length)
  const volumes = flutter.map(voice => voice.volume)
  expect(volumes).toEqual(volumes.toSorted((a, b) => b - a))
})
test('keeps its key from roll to roll while the card sounds a little apart', () => {
  const low = placardVoices({
    ...options,
    variation: -1,
  })
  const high = placardVoices({
    ...options,
    variation: 1,
  })
  expect(low).not.toEqual(high)
  const tuned = notes(placardVoices(options))
  for (const voices of [low, high]) {
    for (const [index, note] of notes(voices).entries()) {
      // within 12 cents of the key
      expect(Math.abs(Math.log2(note.frequency / tuned[index].frequency) * 1200)).toBeLessThan(12)
    }
  }
})
test('a wider placard pats lower but rings the same notes', () => {
  const narrow = placardVoices({
    ...options,
    width: 0.5,
  })
  const wide = placardVoices({
    ...options,
    width: 1.65,
  })
  expect(pat(wide).frequency).toBeLessThan(pat(narrow).frequency)
  expect(notes(wide)).toEqual(notes(narrow))
})
test('starts with the roll and rings out within a second of it resting', () => {
  const voices = placardVoices(options)
  expect(Math.min(...voices.map(voice => voice.delay ?? 0))).toBeGreaterThanOrEqual(0)
  const end = Math.max(...voices.map(voice => (voice.delay ?? 0) + voice.duration))
  expect(end).toBeLessThan(placardRoll.duration + 1)
})
