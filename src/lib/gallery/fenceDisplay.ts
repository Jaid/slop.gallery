import {Minimatch} from 'minimatch'
import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'
import {create} from 'zustand'

export type FenceLineStyle = 'aliased' | 'barycentric'

/** True for every fence, false for none or a minimatch pattern over fence IDs. */
export type FenceDisplay = {fence: boolean | string}

export const fenceLineWidth = {
  min: 1,
  max: 800,
  step: 1,
  default: 100,
} as const
const enabledValues = new Set<unknown>([true, '', 'true'])
const schema = optis({
  defaults: {show_fence: false},
  normalizations: {
    line_width(value: unknown) {
      try {
        const width = parseNumber(value)
        if (Number.isInteger(width) && width >= fenceLineWidth.min && width <= fenceLineWidth.max) {
          return width
        }
      } catch {
      }
      return fenceLineWidth.default
    },
    line_style(value: unknown): FenceLineStyle {
      return value === 'aliased' ? value : 'barycentric'
    },
    show_fence(value: unknown): FenceDisplay['fence'] {
      if (enabledValues.has(value)) {
        return true
      }
      return typeof value === 'string' && value !== 'false' ? value : false
    },
  },
})

/** The initial selection from `?show_fence` or `?show_fence=<pattern>`. */
export function readShowFence(input: URL | string = typeof location === 'undefined' ? '' : location.href): FenceDisplay['fence'] {
  return readPermalink(input, {schema}).show_fence
}

export function readFenceTuning(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  const values = readPermalink(input, {schema})
  return {
    lineStyle: values.line_style ?? 'barycentric',
    lineWidth: values.line_width ?? fenceLineWidth.default,
  }
}
export const initialFenceTuning = readFenceTuning()
export type FenceTuning = typeof initialFenceTuning
export const useFenceDisplay = create<FenceDisplay & FenceTuning>(() => ({
  fence: readShowFence(),
  ...initialFenceTuning,
}))

/** Resolve a display selection in world order, compiling the pattern once for all IDs. */
export function selectFences<Value>(fences: ReadonlyMap<string, Value>, selection: FenceDisplay['fence']): Array<[string, Value]> {
  if (typeof selection === 'boolean') {
    return selection ? [...fences] : []
  }
  // An overlong or too complex pattern in the URL must not stop the scene from rendering.
  try {
    const pattern = new Minimatch(selection, {platform: 'linux'})
    return fences.entries().filter(([id]) => pattern.match(id)).toArray()
  } catch {
    return []
  }
}
