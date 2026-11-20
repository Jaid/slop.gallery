import {expect, test} from 'bun:test'

import FatedRandom from 'fated-random'
import {fromHex} from 'okhsl'

import {slopRandom} from '../../src/lib/gallery/sloperator/sights.ts'
import SlimeMaterial, {slimeColors} from '../../src/lib/materials/SlimeMaterial.ts'
import SlopMaterial, {slopHueSpread} from '../../src/lib/materials/SlopMaterial.ts'

/** The material’s greens back in OkHSL, rounded to whole degrees and percent. */
const greens = (material: SlimeMaterial) => [fromHex(`#${material.color.getHexString()}`), fromHex(`#${material.emissive.getHexString()}`)] as const
/** The hue shift the seed rolls for the slop at the sight. */
const shift = (seed: number, sight: Parameters<typeof slopRandom>[1]) => {
  const slop = new SlopMaterial(slopRandom(seed, sight))
  slop.dispose()
  return slop.hueShift
}
/** How far apart two hues lie round the circle, in degrees. */
const hueGap = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180)
test('the slime keeps its greens, which a Slop’s turn round the hue circle a little, keeping their saturation and lightness', () => {
  const slime = new SlimeMaterial
  try {
    const [color, emissive] = greens(slime)
    for (const [actual, expected] of [[color, slimeColors.color], [emissive, slimeColors.emissive]] as const) {
      expect(hueGap(actual[0], expected[0])).toBeLessThanOrEqual(1)
      expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(1)
      expect(Math.abs(actual[2] - expected[2])).toBeLessThanOrEqual(1)
    }
  } finally {
    slime.dispose()
  }
  const shifts: Array<number> = []
  for (let seed = 1; seed <= 40; seed++) {
    const random = new FatedRandom({seed})
    const slop = new SlopMaterial(random)
    try {
      expect(slop).toBeInstanceOf(SlimeMaterial)
      expect(slop.name).toBe('slop')
      expect(Math.abs(slop.hueShift)).toBeLessThan(slopHueSpread)
      shifts.push(slop.hueShift)
      const [color, emissive] = greens(slop)
      for (const [actual, expected] of [[color, slimeColors.color], [emissive, slimeColors.emissive]] as const) {
        expect(hueGap(actual[0], expected[0] + slop.hueShift)).toBeLessThanOrEqual(1.5)
        expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(1)
        expect(Math.abs(actual[2] - expected[2])).toBeLessThanOrEqual(1)
      }
    } finally {
      slop.dispose()
    }
  }
  // Both ways round the circle, and seldom twice the same
  expect(Math.min(...shifts)).toBeLessThan(-slopHueSpread / 2)
  expect(Math.max(...shifts)).toBeGreaterThan(slopHueSpread / 2)
  const distinct = new Set(shifts.map(rolled => rolled.toFixed(3)))
  expect(distinct.size).toBeGreaterThan(35)
})
test('the seed rolls a green per sight, the same every time it is asked', () => {
  expect(shift(7, 'lobby_east_bench')).toBe(shift(7, 'lobby_east_bench'))
  expect(shift(7, 'lobby_east_bench')).not.toBe(shift(8, 'lobby_east_bench'))
  expect(shift(7, 'lobby_east_bench')).not.toBe(shift(7, 'salon_ottoman'))
})
