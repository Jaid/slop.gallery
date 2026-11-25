import {expect, test} from 'bun:test'

import hsl from 'okhsl'

import {readMoonfallHue} from '../../src/lib/gallery/moonfall/hueParameter.ts'
import {defaultMoonfallHue, moonfallColors, moonfallHue, moonfallPalette, moonfallRope, moonfallRopeColors, moonfallRopeRandom, moonfallRopeSpread, moonfallSlate} from '../../src/lib/gallery/moonfall/palette.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {rollHslShift} from '../../src/lib/seededHsl.ts'
import unpackOkhsl from './helpers/unpackOkhsl.ts'

/** How far apart two hues lie round the circle, in degrees. */
const hueGap = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180)
const keys = Object.keys(moonfallColors) as Array<keyof typeof moonfallColors>
test('Moonfall’s theme is the planet glow’s teal by default, otherwise any whole degree round the circle', () => {
  expect(moonfallHue(0)).toBe(defaultMoonfallHue)
  expect(moonfallColors.planetGlow[0]).toBe(defaultMoonfallHue)
  const sectors = new Set<number>
  for (let seed = 1; seed <= 2000; seed++) {
    const hue = moonfallHue(seed)
    expect(Number.isInteger(hue) && hue >= 0 && hue < 360).toBe(true)
    expect(moonfallHue(seed)).toBe(hue)
    sectors.add(Math.floor(hue / 30))
  }
  expect(sectors.size).toBe(12)
})
test('all of Moonfall’s themed colors turn together with its hue, keeping their saturation and lightness', () => {
  const unturned = moonfallPalette(defaultMoonfallHue)
  for (const key of keys) {
    expect(unturned[key]).toBe(hsl.integer(moonfallColors[key]))
  }
  for (let hue = 0; hue < 360; hue += 23) {
    const palette = moonfallPalette(hue)
    const turn = hue - defaultMoonfallHue
    for (const key of keys) {
      const [ownHue, saturation, lightness] = moonfallColors[key]
      const [turnedHue, turnedSaturation, turnedLightness] = unpackOkhsl(palette[key])
      expect(Math.abs(turnedLightness - lightness)).toBeLessThanOrEqual(1)
      // Dark and pale colors are too coarse in 8 bits to tell their hue or saturation closely.
      if (!(saturation >= 40 && lightness >= 30)) {
        continue
      }
      expect(hueGap(turnedHue, ownHue + turn)).toBeLessThanOrEqual(2)
      expect(Math.abs(turnedSaturation - saturation)).toBeLessThanOrEqual(2)
    }
  }
})
test('the slate floor turns with the theme, its slabs, grout and fractures all from the palette', () => {
  for (const hue of [0, defaultMoonfallHue, 300]) {
    const palette = moonfallPalette(hue)
    const slate = moonfallSlate(palette)
    expect([...slate.slabs, slate.grout, slate.gap, slate.dust].every(hex => Object.values(palette).includes(hex))).toBe(true)
  }
  expect(moonfallSlate(moonfallPalette(0)).slabs).not.toEqual(moonfallSlate(moonfallPalette(defaultMoonfallHue)).slabs)
})
test('the rope keeps its garnet by default, otherwise all its colors move alike within the spread', () => {
  const unturned = moonfallRope(0)
  for (const key of Object.keys(moonfallRopeColors) as Array<keyof typeof moonfallRopeColors>) {
    expect(unturned[key]).toBe(hsl.integer(moonfallRopeColors[key]))
  }
  const shifts = new Set<string>
  for (let seed = 1; seed <= 20; seed++) {
    const [hueShift, , lightnessShift] = rollHslShift(moonfallRopeRandom(seed), moonfallRopeSpread)
    expect(Math.abs(hueShift)).toBeLessThanOrEqual(moonfallRopeSpread.hue)
    expect(Math.abs(lightnessShift)).toBeLessThanOrEqual(moonfallRopeSpread.lightness)
    shifts.add(hueShift.toFixed(3))
    const rope = moonfallRope(seed)
    for (const key of ['pile', 'sheen'] as const) {
      const [hue, , lightness] = unpackOkhsl(rope[key])
      expect(hueGap(hue, moonfallRopeColors[key][0] + hueShift)).toBeLessThanOrEqual(2)
      expect(Math.abs(lightness - moonfallRopeColors[key][2] - lightnessShift)).toBeLessThanOrEqual(1)
    }
  }
  expect(shifts.size).toBe(20)
})
test('?moonfall_hue takes any whole degree from 0 to 359 and ignores anything else', () => {
  expect(readMoonfallHue('http://localhost/')).toBeUndefined()
  expect(readMoonfallHue('http://localhost/?moonfall_hue=0')).toBe(0)
  expect(readMoonfallHue('http://localhost/?moonfall_hue=359')).toBe(359)
  for (const value of ['360', '-5', '12.5', 'teal', '']) {
    expect(readMoonfallHue(`http://localhost/?moonfall_hue=${value}`)).toBeUndefined()
  }
  expect(readQueryOverrides('http://localhost/?moonfall_hue=40')).toEqual({moonfall_hue: 40})
})
