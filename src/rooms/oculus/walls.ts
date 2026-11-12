import type {RoomWall} from '../base/Room.ts'
import type {Vec3} from 'math'

import {apseOpeningPoint, apseOpenings, bastionDoorway} from '#src/lib/gallery/bastion.ts'
import {climbDoorway} from '#src/lib/gallery/climb.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import lowerGallery, {oculusPlatform, oculusRamps} from '#src/lib/gallery/lowerGallery.ts'
import oculusApse from '#src/lib/gallery/oculusApse.ts'
import tunnelDisplays, {displayStairway} from '#src/lib/gallery/tunnelDisplays.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'

import {planWall} from '../lib/walls.ts'

const {oculus, tunnel} = lowerGallery
const [originX, originY, originZ] = roomOrigins.oculus
const height = oculus.ceiling.topY - oculus.ceiling.thickness - oculus.floorY - 0.3
const [, depth] = oculus.size
const local = ([x, y, z]: Vec3): Vec3 => [x - originX, y - originY, z - originZ]
/** The doorways’ sills sit 2 cm under the bridges’ decks, which cover them and the bottoms of their casings. */
const sillDrop = 0.02
/**
 * A side wall along the ramps, whose baseboard follows them up to the turning landing.
 * The east one opens into the Bastion where the east bridge meets it, the west one into its western climb where the west bridge does.
 */
const sideWall = (side: 'east' | 'west'): RoomWall => {
  const ramp = oculusRamps.find(value => value.side === side)!
  const wall = planWall(oculus.size, side, height, {trimStyle: 'plain'})
  const passage = side === 'east' ? bastionDoorway : climbDoorway
  const doorway = local([passage.x, passage.y, passage.z])
  return {
    ...wall,
    baseboardProfile: [
      [oculus.center[1] - depth / 2, ramp.floorY + ramp.rise - oculus.floorY],
      [ramp.startZ - ramp.run, ramp.floorY + ramp.rise - oculus.floorY],
      [ramp.startZ, ramp.floorY - oculus.floorY],
      [ramp.startZ + ramp.width, ramp.floorY - oculus.floorY],
      [ramp.startZ + ramp.width, 0],
      [oculus.center[1] + depth / 2, 0],
    ].map(([z, y]): [number, number] => [(z - oculus.center[1]) * (side === 'east' ? 1 : -1), y]).toSorted((a, b) => a[0] - b[0] || (side === 'east' ? b[1] - a[1] : a[1] - b[1])),
    holes: {
      bastion: {
        u: wallCoordinates(wall, doorway),
        width: passage.width,
        bottom: doorway[1] - sillDrop,
        height: doorway[1] + passage.height,
        profile: 'arch',
      },
    },
  }
}
const southWall = planWall(oculus.size, 'south', height, {trimStyle: 'plain'})
/** A door at the balcony’s level onto the staff stairway down to the tunnel’s display on the side. */
const staffDoor = (side: 'east' | 'west') => {
  const {stairway: {door}} = tunnelDisplays.find(display => display.side === side)!
  const doorAt = local(door)
  return {
    u: wallCoordinates(southWall, doorAt),
    width: displayStairway.doorWidth,
    bottom: doorAt[1],
    height: doorAt[1] + displayStairway.doorHeight,
    profile: 'rectangle',
  } as const
}
/** The south wall, with the tunnel down to the Exhibition leaving its middle, flanked by the doors at the balcony’s level onto the staff stairways down to the displays. */
const south: RoomWall = {
  ...southWall,
  holes: {
    exhibition: {
      u: wallCoordinates(southWall, local([tunnel.north[0], 0, tunnel.north[1]])),
      width: tunnel.width,
      height: tunnel.height,
      profile: 'rectangle',
    },
    west_staff_door: staffDoor('west'),
    east_staff_door: staffDoor('east'),
  },
}
const platformHeight = oculusPlatform.position[1] + oculusPlatform.size[1] / 2 - oculus.floorY
/** The apse’s round walls stand on the platform, each along one of its arcs, and reach up to the same cornice as the side walls. The barred gate and windows onto the Bastion pierce them. */
const [northwest, north, northeast] = oculusApse.arcs.map(({center, radius, from, to}, arc): RoomWall => {
  const angle = (from + to) / 2
  const wall = {
    center: local([center[0] + Math.cos(angle) * radius, oculus.floorY + platformHeight, center[1] + Math.sin(angle) * radius]),
    // Facing the arc’s center, as the plan’s north wall faces south.
    rotation: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
    width: radius * (to - from),
    height: height - platformHeight,
    curveRadius: radius,
    trimStyle: 'plain',
    sticky: false,
  } as const
  const openings = apseOpenings.filter(opening => opening.arc === arc)
  return {
    ...wall,
    ...openings.length ? {holes: Object.fromEntries(openings.map(opening => {
      const [x, z] = apseOpeningPoint(opening)
      return [opening.name, {
        u: wallCoordinates(wall, local([x, 0, z])),
        width: opening.width,
        ...opening.bottom ? {bottom: opening.bottom} : {},
        height: opening.height,
        rise: opening.rise,
        profile: 'arch' as const,
      }]
    }))} : {},
  }
})

export default {
  northwest,
  north,
  northeast,
  east: sideWall('east'),
  west: sideWall('west'),
  south,
} satisfies Record<string, RoomWall>
