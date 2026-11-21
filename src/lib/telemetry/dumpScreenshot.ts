import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

const dumpScreenshotSchema = optis({
  defaults: {
    dump_screenshot: false,
  },
  normalizations: {
    dump_screenshot(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?dump_screenshot` flag that makes every X dump also download the current frame; a bare `?dump_screenshot` counts as enabled. */
export function readDumpScreenshot(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: dumpScreenshotSchema}).dump_screenshot
}

/** whether this page was opened with `?dump_screenshot`, read once at startup */
export const isSavingDumpScreenshots = readDumpScreenshot()
