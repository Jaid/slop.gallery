import type {Lamp, PointLamp} from '../base/Room.ts'

import hsl from 'okhsl'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'
import lowerGallery, {tunnelCenter, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'

const {tunnel} = lowerGallery
const [originX, originY, originZ] = tunnelCenter
/** how far each light hangs under its housing, along the housing’s tilt with the tunnel’s ceiling */
const drop = 0.35
const tilt = -Math.atan(tunnelSlope)
/** under the housing on the tunnel’s ceiling, `s` meters along the diagonal gallery */
const tunnelLamp = (s: number, lamp: Omit<PointLamp, 'position'>): PointLamp => {
  const [cx, cz] = tunnelDiagonalPoint(s)
  const forward = -drop * Math.sin(tilt)
  return {
    ...lamp,
    position: [
      cx + forward * tunnelDiagonalHeading[0] - originX,
      tunnelDiagonalFloorY(s) + tunnel.height - drop * Math.cos(tilt) - originY,
      cz + forward * tunnelDiagonalHeading[1] - originZ,
    ],
  }
}
/** Blue sits halfway between the outermost glass edges. */
const northEdgeS = Math.min(...tunnelDisplays.map(display => display.winNorthS))
const southEdgeS = Math.max(...tunnelDisplays.map(display => display.winSouthS))
const middleS = (northEdgeS + southEdgeS) / 2
/** 730 cm along the sloped ceiling, projected onto the horizontal tunnel axis. */
const spacingS = 7.3 * Math.cos(tilt)
const northS = middleS - spacingS
const southS = middleS + spacingS
export const tunnelLightSs = [northS, middleS, southS] as const

/** the OkHSL hue of the middle tunnel lamp in the default environment, a blue between the north lamp’s green and the south lamp’s red */
export const defaultTunnelHue = 266
/** The OkHSL hue of the middle tunnel lamp: {@link defaultTunnelHue} in the default environment, otherwise a whole degree rolled from the seed. */
export function tunnelHue(seed: number) {
  if (isDefaultSeed(seed)) {
    return defaultTunnelHue
  }
  return environmentRandom(seed).makeChild(['exhibition', 'tunnel-hue']).rollInteger(359)
}
/** The tints of the tunnel lamps, north to south: their hues a third of the circle apart round the middle one’s, each with its own saturation and lightness in OkHSL. */
export function tunnelTints(middleHue: number) {
  return [hsl.integer(middleHue - 120, 100, 86), hsl.integer(middleHue, 100, 56), hsl.integer(middleHue + 120, 100, 62)] as const
}
const [northTint, middleTint, southTint] = tunnelTints(tunnelHue(environmentSeed))

/** the color of the staff stairways’ lamps */
export const stairwayTint = '#a3d2cc'
const stairways = Object.fromEntries(tunnelDisplays.flatMap(({side, stairway}) => Object.entries(stairway.lamps).map(([name, [x, y, z]]) => [`${side}_stairway_${name}`, {
  position: [x - originX, y - drop - originY, z - originZ],
  strength: 16,
  tint: stairwayTint,
  range: 12,
  decay: 1,
} satisfies Lamp])))

export default {
  // From the tunnel’s low north end up to its high south end, lighting both displays at once: green, blue and red by default.
  tunnel_north: tunnelLamp(northS, {
    strength: 25,
    tint: northTint,
    range: 10,
    decay: 1.25,
    shadow: true,
  }),
  tunnel_middle: tunnelLamp(middleS, {
    strength: 13.2,
    tint: middleTint,
    range: 10,
    decay: 1,
  }),
  tunnel_south: tunnelLamp(southS, {
    strength: 33,
    tint: southTint,
    range: 17,
    decay: 1.5,
    shadow: true,
  }),
  ...stairways,
} satisfies Record<string, Lamp>
