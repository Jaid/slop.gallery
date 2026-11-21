import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'
import {create} from 'zustand'

export type OverlayLineStyle = 'aliased' | 'barycentric'

export const overlayLineWidth = {
  min: 1,
  max: 800,
  step: 1,
  default: 100,
} as const
const schema = optis({
  normalizations: {
    line_width(value: unknown) {
      try {
        const width = parseNumber(value)
        if (Number.isInteger(width) && width >= overlayLineWidth.min && width <= overlayLineWidth.max) {
          return width
        }
      } catch {
      }
      return overlayLineWidth.default
    },
    line_style(value: unknown): OverlayLineStyle {
      return value === 'aliased' ? value : 'barycentric'
    },
  },
})

export function readOverlayTuning(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  const values = readPermalink(input, {schema})
  return {
    lineStyle: values.line_style ?? 'barycentric',
    lineWidth: values.line_width ?? overlayLineWidth.default,
  }
}
export const initialOverlayTuning = readOverlayTuning()
export type OverlayTuning = typeof initialOverlayTuning
export const useOverlayTuning = create<OverlayTuning>(() => initialOverlayTuning)
