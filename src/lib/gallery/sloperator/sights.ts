import type {GalleryRoomId} from '../../../worlds/gallery/index.ts'
import type {Vec3} from '../types.ts'
import type {SloperatorSeat} from './SloperatorGeometry.ts'

import {environmentRandom} from '../../environmentSeed.ts'
import {fountainBench, fountainBenches} from '../fountainBenches.ts'
import lodge from '../lodge.ts'
import lodgeInterior from '../lodgeInterior/layout.ts'
import UpholsteredSeatGeometry from '../lodgeInterior/UpholsteredSeatGeometry.ts'
import {tunnelDiagonalPoint, tunnelDiagonalYaw, tunnelFloorHeight, tunnelSlope} from '../lowerGallery.ts'
import {salonBench} from '../salon.ts'
import tunnelDisplays from '../tunnelDisplays.ts'
import SloperatorGeometry from './SloperatorGeometry.ts'

/** the furniture a seat of his is: the name of its rigid body, and where that stands when a game begins, its origin and its turn around y, in the museum’s meters and radians */
export type SloperatorFurniture = {
  body: string
  position: Vec3
  yaw: number
}
/** a place the Sloperator turns up at while the player is somewhere it can be seen from: on a seat, or on his feet */
export type SloperatorSight = SightPlace & {id: string}
/** a sight of his with a seat */
export type SloperatorSeatedSight = SloperatorSight & {
  furniture: SloperatorFurniture
  seat: SloperatorSeat
}
/** where the Sloperator turns up while the player is somewhere it can be seen from, by the id of the sight */
type SightPlace = {
  /** the id of the fence of the gallery the player’s place has to be in for him to turn up there, a room’s or not */
  fence: string
  /** whether no sun reaches him there */
  indoors?: boolean
  /** where he sits while his seat stands where it stood when the game began, or where he stands at a sight without one: the point on the floor under him, in the museum’s meters */
  position: Vec3
  /** the room he is in there, which he belongs to */
  room: GalleryRoomId
  /** how the floor slopes where he stands at a sight without a seat: rising `grade` meters per meter toward the turn `yaw` around y; level without */
  slope?: {
    grade: number
    yaw: number
  }
  /** which way he faces there, as his turn around y in radians: +z without one */
  yaw: number
} & ({
  /** none: he stands */
  furniture?: undefined
  seat?: undefined
} | {
  /** the furniture he sits on there */
  furniture: SloperatorFurniture
  seat: SloperatorSeat
})

const {armchairs, armchairSpread, seatWidth} = lodgeInterior
const {armHeight, armRollOffset, armRollRadius, armWidth, seatHeight} = UpholsteredSeatGeometry
/** Where a point on the floor lies in the museum that lies at `[x, z]` in the frame of something standing at `origin`, turned by `yaw`. */
export function inFrame([originX, y, originZ]: Vec3, yaw: number, x: number, z: number): Vec3 {
  return [originX + x * Math.cos(yaw) + z * Math.sin(yaw), y, originZ - x * Math.sin(yaw) + z * Math.cos(yaw)]
}
/** The Lodge’s armchair at `index`, see {@link lodgeInterior}, which has its back to a window, as his seat: leaning back in it, his forearms on the rolls of its arms. */
function lodgeArmchair(index: number, fence: string) {
  const {position, yaw} = armchairs[index]
  const spot: Vec3 = [lodge.center[0] + position[0], lodge.floorY + position[1], lodge.center[1] + position[2]]
  return {
    fence,
    furniture: {
      body: `lodge-armchair-${index}`,
      position: spot,
      yaw,
    },
    indoors: true,
    position: spot,
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
    yaw,
  } as const
}
/** how far behind the middle of a seat without a back he sits to face out over its front edge, `depth` deep, so his thighs reach to that edge */
const behindMiddle = (depth: number) => SloperatorGeometry.lap - depth / 2
/** The Lobby’s fountain bench at `index`, see {@link fountainBenches}, as his seat: `along` meters from its middle toward his right as he sits on it, facing the fountain over its front edge like the bench. */
function lobbyBench(index: number, along: number, fence: string) {
  const {name, position, rotation: [, yaw]} = fountainBenches[index]
  return {
    fence,
    furniture: {
      body: name,
      position,
      yaw,
    },
    position: inFrame(position, yaw, along, behindMiddle(fountainBench.depth)),
    room: 'lobby',
    seat: {height: fountainBench.height},
    yaw: yaw + Math.PI,
  } as const
}
/** the east display along the Exhibition’s diagonal, whose glass faces west into the tunnel, and the first of its exhibits, from the Oculus */
const eastDisplay = tunnelDisplays.find(({side}) => side === 'east')!
const [firstExhibitX, , firstExhibitZ] = eastDisplay.exhibits[0].position
/** where he stands in the Exhibition: 2.5 m down its diagonal from the north elbow, 30 cm west of its middle, on the floor sloping up toward Moonfall */
const [glassX, glassZ] = tunnelDiagonalPoint(2.5, -0.3)
/**
 * Where the Sloperator turns up, by the ids of his sights: each a seat he only sits on, or a spot he only stands on, while the player’s place is in a fence it can be seen from, but never reached from, through a window, across a room or down a hall, so nobody ever finds him in the room around them.
 * Where his seat went or what lies in his way when the player enters that fence, see `placement.ts`; what becomes of a sight once the player has caught sight of him there, see `sightings.ts`.
 */
const places = {
  /** In the Lodge’s armchair by its east window, leaning back, his back to the window: the knight’s alley of the Bastion sees his hat and the back of his head over the window’s sill. */
  lodge_east_armchair: lodgeArmchair(0, 'knight_alley'),
  /** In the Lodge’s armchair by its west window, leaning back, his back to the window: the Corridor’s long hall sees his hat and the back of his head over the deep sill of the window’s niche. */
  lodge_west_armchair: lodgeArmchair(1, 'corridor_window'),
  /** On the south end of the bench east of the Lobby’s fountain, facing the fountain like the bench: the Salon sees him from behind and from the side, from along its glass wall onto the Lobby, through its cast panes. */
  lobby_east_bench: lobbyBench(1, -1, 'salon'),
  /** In the middle of the bench north of the Lobby’s fountain, facing the fountain like the bench: the Oculus sees his back from its platform and its apse, far off and from below, up through the glazed floor between them. */
  lobby_north_bench: lobbyBench(2, 0, 'oculus'),
  /** On the middle of the Salon’s ottoman, facing north to the sculpture: the Forge sees him from the side, across the Lobby and through both of its glass walls, his hat and his head over their sills. */
  salon_ottoman: {
    fence: 'forge',
    furniture: {
      body: 'salon-ottoman',
      position: salonBench.position,
      yaw: 0,
    },
    position: inFrame(salonBench.position, 0, 0, behindMiddle(salonBench.depth)),
    room: 'salon',
    seat: {height: salonBench.seatHeight},
    yaw: Math.PI,
  },
  /** Standing in the Exhibition, looking through the glass of its east display at the first exhibit in it: the Bastion behind the Oculus’ gate sees his back through the apse’s west window, beside the tower and over the platform’s edge, the length of the Oculus away down into the tunnel. */
  exhibition_glass: {
    fence: 'bastion_gate',
    position: [glassX, tunnelFloorHeight(glassX, glassZ)!, glassZ],
    room: 'exhibition',
    slope: {
      grade: tunnelSlope,
      yaw: tunnelDiagonalYaw,
    },
    yaw: Math.atan2(firstExhibitX - glassX, firstExhibitZ - glassZ),
  },
} as const satisfies Record<string, SightPlace>

export type SloperatorSightId = keyof typeof places

/** The rolls of the slop at a sight in the environment of `seed`: the slop in front of his face there and the Slop he leaves, which share their green. */
export function slopRandom(seed: number, sight: SloperatorSightId) {
  return environmentRandom(seed).makeChild(['slop', sight])
}

/** every sight of the Sloperator in the gallery */
const sights: ReadonlyArray<SloperatorSight & {id: SloperatorSightId}> = (Object.keys(places) as Array<SloperatorSightId>).map(id => ({
  id,
  ...places[id],
}))

export default sights
