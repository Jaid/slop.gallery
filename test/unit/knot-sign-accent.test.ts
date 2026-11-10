import {expect, test} from 'bun:test'

import {Color, SRGBColorSpace} from 'three/webgpu'

import signAccentColor from '../../src/components/signAccentColor.ts'

const hslOf = (style: string) => {
  const hsl = {
    h: 0,
    s: 0,
    l: 0,
  }
  const color = new Color(style)
  color.getHSL(hsl, SRGBColorSpace)
  return hsl
}
test('sign accents keep the hue of their placeholder colors, but never too dark, too saturated or white to read on the dark plaques', () => {
  for (const placeholder of ['#1d1436', '#0000ff', '#ffffff', '#000000', '#3cf0b0']) {
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
