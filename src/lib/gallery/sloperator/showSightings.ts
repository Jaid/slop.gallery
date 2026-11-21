import optis from 'optis'
import readPermalink from 'read-permalink'

const enabledValues = new Set<unknown>([true, '', 'true'])
const showSloperatorSightingsSchema = optis({
  defaults: {
    show_sloperator_sightings: false,
  },
  normalizations: {
    show_sloperator_sightings(value: unknown) {
      return enabledValues.has(value)
    },
  },
})

/** Read the `?show_sloperator_sightings` flag that outlines every possible sight in the current world’s reach; a bare `?show_sloperator_sightings` counts as enabled. */
export function readShowSloperatorSightings(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: showSloperatorSightingsSchema}).show_sloperator_sightings
}

/** whether this page was opened with `?show_sloperator_sightings`, read once at startup */
export const isShowingSloperatorSightings = readShowSloperatorSightings()
