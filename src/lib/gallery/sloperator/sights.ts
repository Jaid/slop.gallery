import type {GalleryRoomId} from '../../../worlds/gallery/index.ts'
import type {Vec3} from '../types.ts'
import type {SloperatorSeat} from './SloperatorGeometry.ts'

import {environmentRandom} from '../../environmentSeed.ts'
import {fountainBench, fountainBenches} from '../fountainBenches.ts'
import lodge from '../lodge.ts'
import lodgeInterior from '../lodgeInterior/layout.ts'
import UpholsteredSeatGeometry from '../lodgeInterior/UpholsteredSeatGeometry.ts'
import {salonBench} from '../salon.ts'
import SloperatorGeometry from './SloperatorGeometry.ts'

/** a seat the Sloperator sits on while the player is somewhere it can be seen from */
export type SloperatorSight = {
  /** the id of the fence of the gallery the player’s place has to be in for him to sit there, a room’s or not */
  fence: string
  id: string
  /** whether no sun reaches him there */
  indoors?: boolean
  /** where he sits: the point on the floor under him, in the museum’s meters */
  position: Vec3
  /** the room his seat stands in, which he belongs to there */
  room: GalleryRoomId
  seat: SloperatorSeat
  /** which way he faces, as his turn around y in radians: +z without one */
  yaw: number
}

const {armchairs, armchairSpread, seatWidth} = lodgeInterior
const {armHeight, armRollOffset, armRollRadius, armWidth, seatHeight} = UpholsteredSeatGeometry
/** the Lodge’s armchair in front of its east window onto the Bastion’s knight’s alley, its back to the window */
const armchair = armchairs[0]
/** the bench east of the Lobby’s fountain */
const bench = fountainBenches[1]
/** Where a point on the floor lies in the museum that lies at `[x, z]` in the frame of something standing at `position`, turned by `yaw`. */
function standing([originX, y, originZ]: Vec3, yaw: number, x: number, z: number): Vec3 {
  return [originX + x * Math.cos(yaw) + z * Math.sin(yaw), y, originZ - x * Math.sin(yaw) + z * Math.cos(yaw)]
}
/** how far behind the middle of a seat without a back he sits to face out over its front edge, `depth` deep, so his thighs reach to that edge */
const behindMiddle = (depth: number) => SloperatorGeometry.lap - depth / 2
/**
 * Where the Sloperator turns up, by the ids of his sights: each a seat he only sits on while the player’s place is in a fence the seat can be seen from, but never reached from, through a window or across a room, so nobody ever finds him sitting in the room around them.
 * What becomes of a sight once the player has caught sight of him there, see `sightings.ts`.
 */
const seats = {
  /** In the Lodge’s armchair, leaning back, his back to the east window: the knight’s alley of the Bastion sees his hat and the back of his head over the window’s sill. */
  lodge_armchair: {
    fence: 'knight_alley',
    indoors: true,
    position: [lodge.center[0] + armchair.position[0], lodge.floorY + armchair.position[1], lodge.center[1] + armchair.position[2]],
    room: 'lodge',
    seat: {
      arms: {
        height: armHeight,
        radius: armRollRadius,
        x: (seatWidth + armchairSpread) / 2 + armWidth / 2 + armRollOffset,
      },
      height: seatHeight,
      lean: 0.12,
    },
    yaw: armchair.yaw,
  },
  /** On the south end of the bench east of the Lobby’s fountain, facing the fountain like the bench: the Salon sees him from behind and from the side, from along its glass wall onto the Lobby, through its cast panes. */
  lobby_bench: {
    fence: 'salon',
    position: standing(bench.position, bench.rotation[1], -1, behindMiddle(fountainBench.depth)),
    room: 'lobby',
    seat: {height: fountainBench.height},
    yaw: bench.rotation[1] + Math.PI,
  },
  /** On the middle of the Salon’s ottoman, facing north to the sculpture: the Forge sees him from the side, across the Lobby and through both of its glass walls, his hat and his head over their sills. */
  salon_ottoman: {
    fence: 'forge',
    position: standing(salonBench.position, 0, 0, behindMiddle(salonBench.depth)),
    room: 'salon',
    seat: {height: salonBench.seatHeight},
    yaw: Math.PI,
  },
} as const satisfies Record<string, Omit<SloperatorSight, 'id'>>

export type SloperatorSightId = keyof typeof seats

/** The rolls of the slop at a sight in the environment of `seed`: the slop in front of his face there and the Slop he leaves, which share their green. */
export function slopRandom(seed: number, sight: SloperatorSightId) {
  return environmentRandom(seed).makeChild(['slop', sight])
}

/** every sight of the Sloperator in the gallery */
const sights: ReadonlyArray<SloperatorSight & {id: SloperatorSightId}> = (Object.keys(seats) as Array<SloperatorSightId>).map(id => ({
  id,
  ...seats[id],
}))

export default sights
