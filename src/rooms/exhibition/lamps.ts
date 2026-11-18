import type {Lamp, PointLamp} from '../base/Room.ts'

import lowerGallery, {tunnelCenter, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'

const {tunnel} = lowerGallery
const [originX, originY, originZ] = tunnelCenter
/** how far each light hangs under its housing, along the housing’s tilt with the tunnel’s ceiling */
const drop = 0.35
const tilt = -Math.atan(tunnelSlope)
/** under the housing on the tunnel’s ceiling abreast of a row of exhibits, `s` meters along the diagonal gallery */
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
export const tunnelLightSs: readonly [number, number, number] = [0, 1, 2].map(index => (tunnelDisplays[0].exhibits[index].s + tunnelDisplays[1].exhibits[index].s) / 2) as unknown as readonly [number, number, number]
const [northS, middleS, southS] = tunnelLightSs

/** the color of the staff stairways’ lamps */
export const stairwayTint = '#a3d2cc'
/** where each stairway’s lamps hang under its ceilings */
const stairwayLamps = ['door', 'ramp', 'landing'] as const
const stairways = Object.fromEntries(tunnelDisplays.flatMap(({side, stairway}) => stairway.lamps.map(([x, y, z], index) => [`${side}_stairway_${stairwayLamps[index]}`, {
  position: [x - originX, y - drop - originY, z - originZ],
  strength: 16,
  tint: stairwayTint,
  range: 12,
  decay: 1,
} satisfies Lamp])))

export default {
  // Green, blue and red, from the tunnel’s low north end up to its high south end, abreast of each row of exhibits, lighting both displays at once.
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
