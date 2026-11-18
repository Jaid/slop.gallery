import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'

const fovSchema = optis({
  normalizations: {
    fov(value: unknown) {
      try {
        const fov = parseNumber(value)
        if (fov > 0 && fov < 180) {
          return fov
        }
      } catch {
      }
    },
  },
})

/**
 * Read an optional vertical field of view in degrees, above 0 and below 180, for the game camera from the permalink; `undefined` keeps the default.
 * A given one is the view’s for good, apart from what the player’s own keys do to it, zooming with Z and viewing with V: nothing else modifies it, neither a mood’s widening nor a `?spawn` camera bookmark’s own field of view.
 */
export function readFov(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: fovSchema}).fov
}

/** the page’s `?fov`, which keeps every modifier of the field of view off but the player’s zoom and V-viewing, or undefined without one */
export const pageFov = readFov()
