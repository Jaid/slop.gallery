import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

const telemetrySchema = optis({
  defaults: {
    telemetry: false,
  },
  normalizations: {
    telemetry(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?telemetry` flag that opts into collecting and sending telemetry; a bare `?telemetry` counts as enabled. */
export function readTelemetry(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: telemetrySchema}).telemetry
}
