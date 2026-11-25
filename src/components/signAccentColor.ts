import {clamp} from 'math'
import {Color, SRGBColorSpace} from 'three/webgpu'

const saturationMaximum = 0.75
const lightnessMinimum = 0.7
const lightnessMaximum = 0.85

/** Preserve the exhibit hue while keeping sign accents readable against the dark plaques. */
export default function signAccentColor(value: number) {
  const hsl = {
    h: 0,
    s: 0,
    l: 0,
  }
  const color = new Color(value)
  color.getHSL(hsl, SRGBColorSpace)
  color.setHSL(hsl.h, Math.min(hsl.s, saturationMaximum), clamp(hsl.l, lightnessMinimum, lightnessMaximum), SRGBColorSpace)
  return color.getStyle(SRGBColorSpace)
}
