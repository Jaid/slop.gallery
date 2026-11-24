import type {TuningColor} from './controls.ts'

import {okhsl} from 'okhsl'

import {hslHex} from '#src/lib/seededHsl.ts'

/** the axes of a color as the tools tell and take it, each with its greatest amount and what it stands at where left out: hue 0°, saturation 100% and lightness 50% */
const axes = [
  ['hue', 360, 0],
  ['saturation', 100, 100],
  ['lightness', 100, 50],
] as const

/** The color of #rrggbb as the tools tell it, in whole degrees and percent like the panel’s sliders, which give back the color itself or, as whole numbers don’t reach every #rrggbb, one close to it. */
export function tellColor(hex: string): TuningColor {
  const [hue, saturation, lightness] = okhsl.fromHex(hex)
  return {
    hue,
    saturation,
    lightness,
  }
}

/** The #rrggbb of a color the tools give as {@link TuningColor}, any axis left out at its default, or a TypeError, naming the value `name`, saying what it takes. */
export function readColor(value: unknown, name: string): string {
  const takes = `${name} is a color as its OkHSL {hue, saturation, lightness}: a hue from 0 to 360°, a saturation and a lightness from 0 to 100%, any left out at 0°, 100% and 50%.`
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value).some(key => !axes.some(([axis]) => axis === key))) {
    throw new TypeError(takes)
  }
  const given = value as Partial<Record<string, unknown>>
  const [hue, saturation, lightness] = axes.map(([axis, max, fallback]) => {
    const amount = Object.hasOwn(given, axis) ? given[axis] : fallback
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > max) {
      throw new TypeError(takes)
    }
    return amount
  })
  return hslHex([hue, saturation, lightness])
}
