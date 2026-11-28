import {expect, test} from 'bun:test'

import hsl from 'okhsl'
import StableRandom from 'stable-random'

import {unpackOkhsl} from '#src/lib/color.ts'

import {salonVelvet, salonVelvetColors, salonVelvetRandom} from '../../src/lib/gallery/salonVelvet.ts'
import {rollHslShift, seededHsl, seededHue} from '../../src/lib/seededHsl.ts'
import {defaultTunnelHue, tunnelHue, tunnelTints} from '../../src/rooms/exhibition/lamps.ts'

/** How far apart two hues lie round the circle, in degrees. */
const hueGap = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180)
test('a seeded hue only turns the hue, by the same roll every time and up to the spread', () => {
  const color = [200, 80, 60] as const
  for (let seed = 1; seed <= 30; seed++) {
    const random = new StableRandom({seed})
    const [hueShift, saturationShift, lightnessShift] = rollHslShift(random, {hue: 30})
    expect(Math.abs(hueShift)).toBeLessThan(30)
    expect([saturationShift, lightnessShift]).toEqual([0, 0])
    expect(seededHue(color, random, 30)).toBe(hsl.integer(color[0] + hueShift, color[1], color[2]))
  }
})
test('saturation and lightness spread on rolls of their own, which leave the hue’s alone, and stay within 0–100', () => {
  const random = new StableRandom({seed: 5})
  const [hueAlone] = rollHslShift(random, {hue: 20})
  const [hue, saturation, lightness] = rollHslShift(random, {
    hue: 20,
    saturation: 10,
    lightness: 10,
  })
  expect(hue).toBe(hueAlone)
  expect(saturation).not.toBe(lightness)
  expect(Math.abs(saturation)).toBeLessThan(10)
  expect(Math.abs(lightness)).toBeLessThan(10)
  expect(seededHsl([0, 140, -20], random, {})).toBe(0x00_00_00)
  expect(seededHsl([30, 50, 50], random, {})).toBe(hsl.integer(30, 50, 50))
})
test('the tunnel lamps sit a third of the hue circle apart around a seeded whole-degree middle hue', () => {
  expect(tunnelHue(0)).toBe(defaultTunnelHue)
  const hues = Array.from({length: 200}, (_, index) => tunnelHue(index + 1))
  for (const hue of hues) {
    expect(Number.isInteger(hue)).toBe(true)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThanOrEqual(359)
  }
  const distinct = new Set(hues)
  expect(distinct.size).toBeGreaterThan(120)
  expect(tunnelHue(7)).toBe(tunnelHue(7))
  for (const middle of [0, defaultTunnelHue, 359]) {
    const [north, center, south] = tunnelTints(middle).map(unpackOkhsl)
    expect(hueGap(center[0], middle)).toBeLessThanOrEqual(2)
    expect(hueGap(north[0], middle - 120)).toBeLessThanOrEqual(2)
    expect(hueGap(south[0], middle + 120)).toBeLessThanOrEqual(2)
  }
})
test('the Salon ottoman keeps its velvet’s colors by default, otherwise all of them turn alike', () => {
  const unturned = salonVelvet(0)
  for (const key of Object.keys(salonVelvetColors) as Array<keyof typeof salonVelvetColors>) {
    expect(unturned[key]).toBe(hsl.integer(salonVelvetColors[key]))
  }
  // from the upright pile swallowing the light up to the sheen
  const {crushed, deep, pile, sheen} = salonVelvetColors
  expect([deep, pile, crushed, sheen].map(([, , lightness]) => lightness)).toEqual([deep[2], pile[2], crushed[2], sheen[2]].toSorted((first, second) => first - second))
  const shifts = new Set<string>
  for (let seed = 1; seed <= 20; seed++) {
    const [shift] = rollHslShift(salonVelvetRandom(seed), {hue: 20})
    shifts.add(shift.toFixed(3))
    const velvet = salonVelvet(seed, {hue: 20})
    for (const key of ['crushed', 'pile', 'sheen'] as const) {
      const [hue] = unpackOkhsl(velvet[key])
      expect(hueGap(hue, salonVelvetColors[key][0] + shift)).toBeLessThanOrEqual(2)
    }
  }
  expect(shifts.size).toBe(20)
})
