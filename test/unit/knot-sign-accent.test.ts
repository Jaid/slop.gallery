import {expect, test} from 'bun:test'

import hsl from 'okhsl'
import {Color, SRGBColorSpace} from 'three/webgpu'

import signAccentColor from '../../src/components/signAccentColor.ts'

const hslOf = (style: number | string) => {
  const channels = {
    h: 0,
    s: 0,
    l: 0,
  }
  const color = new Color(style)
  color.getHSL(channels, SRGBColorSpace)
  return channels
}
test('sign accents keep the hue of their placeholder colors, but never too dark, too saturated or white to read on the dark plaques', () => {
  for (const placeholder of [hsl.integer(293, 59, 12), hsl.integer(264.06, 100, 36.6), hsl.integer(0, 0, 100), hsl.integer(0, 0, 0), hsl.integer(164, 91, 83)]) {
    const accent = signAccentColor(placeholder)
    expect(accent).toMatch(/^rgb\(\d+,\d+,\d+\)$/u)
    const before = hslOf(placeholder)
    const after = hslOf(accent)
    expect(after.l).toBeGreaterThan(0.6)
    expect(after.l).toBeLessThan(0.95)
    expect(after.s).toBeLessThanOrEqual(0.8)
    if (before.s > 0.1) {
      expect(Math.abs(after.h - before.h)).toBeLessThan(0.02)
    }
  }
})
