import type {Lamp, PointLamp} from '../base/Room.ts'

import {frameToWorld, tunnelCenter, tunnelFloorHeight, tunnelSlope} from '#src/lib/gallery/exhibitionTunnel.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'

const {tunnel} = lowerGallery
const [originX, originY, originZ] = tunnelCenter
/** how far each light hangs under its housing, along the housing’s tilt with the tunnel’s ceiling */
const drop = 0.35
const tilt = -Math.atan(tunnelSlope)
/** where the tunnel’s lamps hang down its diagonal: abreast of the middle of both displays’ rows of exhibits, each between the west and the east one, which the displays’ different sites stagger */
export const tunnelLampZs = tunnelDisplays[0].exhibits.map((exhibit, index) => (exhibit.position[2] + tunnelDisplays[1].exhibits[index].position[2]) / 2)
/** under the housing on the tunnel’s ceiling over the diagonal’s center line, `z` meters down it */
const tunnelLamp = (z: number, lamp: Omit<PointLamp, 'position'>): PointLamp => {
  const [x, worldZ] = frameToWorld([0, z - drop * Math.sin(tilt)])
  return {
    ...lamp,
    position: [x - originX, tunnelFloorHeight(z) + tunnel.height - drop * Math.cos(tilt) - originY, worldZ - originZ],
  }
}
const [northZ, middleZ, southZ] = tunnelLampZs
/** the color of the staff stairways’ lamps */
export const stairwayTint = '#a3d2cc'
/** where each stairway’s lamps hang under its ceilings, from the door down to the landing */
const stairwayLamps = ['door', 'middle', 'landing'] as const
const stairways = Object.fromEntries(tunnelDisplays.flatMap(({side, stairway}) => stairway.lamps.map(([x, y, z], index) => {
  const [worldX, worldZ] = frameToWorld([x, z])
  return [`${side}_stairway_${stairwayLamps[index]}`, {
    position: [worldX - originX, y - drop - originY, worldZ - originZ],
    strength: 16,
    tint: stairwayTint,
    range: 12,
    decay: 1,
  } satisfies Lamp]
})))

export default {
  // Green, blue and red, from the tunnel’s low north end up to its high south end, abreast of each row of exhibits, lighting both displays at once.
  tunnel_green: tunnelLamp(northZ, {
    strength: 25,
    tint: '#4dff6a',
    range: 10,
    decay: 1.25,
    shadow: true,
  }),
  tunnel_blue: tunnelLamp(middleZ, {
    strength: 13.2,
    tint: '#4d7aff',
    range: 10,
    decay: 1,
  }),
  tunnel_red: tunnelLamp(southZ, {
    strength: 33,
    tint: '#ff4d4d',
    range: 17,
    decay: 1.5,
    shadow: true,
  }),
  ...stairways,
} satisfies Record<string, Lamp>
