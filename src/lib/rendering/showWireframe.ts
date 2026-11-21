import optis from 'optis'
import readPermalink from 'read-permalink'

const enabledValues = new Set<unknown>([true, '', 'true'])

/** `true` for the classic 1 px hardware lines, a line width in hundredths of a pixel at a 1080 px short edge for antialiased edges, `false` for the regular look */
export type ShowWireframeFlag = boolean | number

const showWireframeSchema = optis({
  defaults: {
    show_wireframe: false,
  },
  normalizations: {
    show_wireframe(value: unknown): ShowWireframeFlag {
      if (enabledValues.has(value)) {
        return true
      }
      const text = typeof value === 'number' ? String(value) : value
      if (typeof text === 'string' && /^\d+$/.test(text)) {
        return Number(text) || false
      }
      return false
    },
  },
})

/** Read the `?show_wireframe` flag that renders the scene as wireframe instead of its regular look: a bare `?show_wireframe` or `true` draws classic 1 px hardware lines, a positive integer draws antialiased edges that many hundredths of a pixel wide at a 1080 px short edge (100 = 2 px at 4K UHD), and `false` or `0`, like anything else, keeps the regular look. */
export function readShowWireframe(input: URL | string = typeof location === 'undefined' ? '' : location.href): ShowWireframeFlag {
  return readPermalink(input, {schema: showWireframeSchema}).show_wireframe
}

/** the `?show_wireframe` flag of this page, read once at startup */
export const showWireframe = readShowWireframe()

/** whether this page was opened with `?show_wireframe`, read once at startup */
export const isShowingWireframe = showWireframe !== false
