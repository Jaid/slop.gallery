import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'

/** The Studio sizes the URL and world tuning accept, in whole meters. */
export const roomSizeLimits = {
  width: [6, 20],
  depth: [6, 20],
  height: [6, 12],
} as const

const dimension = ([min, max]: readonly [number, number]) => (value: unknown) => {
  try {
    const meters = parseNumber(value)
    if (Number.isInteger(meters) && meters >= min && meters <= max) {
      return meters
    }
  } catch {
  }
}
const schema = optis({
  normalizations: {
    room_width: dimension(roomSizeLimits.width),
    room_depth: dimension(roomSizeLimits.depth),
    room_height: dimension(roomSizeLimits.height),
  },
})

/** Read the Studio’s clear width, depth and ceiling height; an absent or invalid dimension keeps the seed’s value. */
export function readRoomSize(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  const {room_width: width, room_depth: depth, room_height: height} = readPermalink(input, {schema})
  return {
    width,
    depth,
    height,
  }
}
