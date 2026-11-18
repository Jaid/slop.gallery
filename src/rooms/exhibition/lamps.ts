import type {Lamp, PointLamp} from '../base/Room.ts'

import lowerGallery, {tunnelCenter, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'

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
  // Green, blue and red, from the tunnel’s low north end up to its high south end, lighting both displays at once.
  tunnel_green: tunnelLamp(northS, {
    strength: 25,
    tint: '#4dff6a',
    range: 10,
    decay: 1.25,
    shadow: true,
  }),
  tunnel_blue: tunnelLamp(middleS, {
    strength: 13.2,
    tint: '#4d7aff',
    range: 10,
    decay: 1,
  }),
  tunnel_red: tunnelLamp(southS, {
    strength: 33,
    tint: '#ff4d4d',
    range: 17,
    decay: 1.5,
    shadow: true,
  }),
  ...stairways,
} satisfies Record<string, Lamp>
