import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lowerGallery, {tunnelBoundary, tunnelDiagonalFloorY, tunnelDiagonalPoint, tunnelDiagonalYaw, tunnelSlope, tunnelSlopeEndS, tunnelSlopeStartS} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays, {tunnelDisplayWindow} from '#src/lib/gallery/tunnelDisplays.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'

import {localWalls} from '../lib/walls.ts'

type Point = readonly [number, number]

const {tunnel} = lowerGallery
const halfW = tunnel.width / 2
const [originX, originY, originZ] = roomOrigins.exhibition
const [w0, w1, w2, w3] = tunnelBoundary.west
const [e0, e1, e2, e3] = tunnelBoundary.east
const wSlopeStart = tunnelDiagonalPoint(tunnelSlopeStartS, -halfW)
const wSlopeEnd = tunnelDiagonalPoint(tunnelSlopeEndS, -halfW)
const eSlopeStart = tunnelDiagonalPoint(tunnelSlopeStartS, halfW)
const eSlopeEnd = tunnelDiagonalPoint(tunnelSlopeEndS, halfW)
/** Straight level wall between two world xz endpoints (`from -> to`), facing `inwardSide` × `rightOf(to - from)`. */
function levelSegmentWall(id: string, from: Point, to: Point, floorY: number, inwardSide: -1 | 1): Wall {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const length = Math.hypot(dx, dz)
  const ux = dx / length
  const uz = dz / length
  const nx = -uz * inwardSide
  const nz = ux * inwardSide
  return {
    id,
    room: 'exhibition',
    center: [(from[0] + to[0]) / 2, floorY, (from[1] + to[1]) / 2],
    rotation: Math.atan2(nx, nz),
    width: length,
    height: tunnel.height,
    sticky: false,
    trimStyle: 'plain',
  }
}
/** Main sloped diagonal wall (`s = tunnelSlopeStartS .. tunnelSlopeEndS`) with its glazed display window. */
function diagonalWall(side: 'east' | 'west'): Wall {
  const direction = side === 'west' ? -1 : 1
  const display = tunnelDisplays.find(d => d.side === side)!
  const sMid = (tunnelSlopeStartS + tunnelSlopeEndS) / 2
  const span = tunnelSlopeEndS - tunnelSlopeStartS
  const [cx, cz] = tunnelDiagonalPoint(sMid, direction * halfW)
  const rotation = (side === 'west' ? Math.PI / 2 : -Math.PI / 2) + tunnelDiagonalYaw
  const wall: Wall = {
    id: `exhibition-${side}`,
    room: 'exhibition',
    center: [cx, tunnelDiagonalFloorY(sMid), cz],
    rotation,
    width: span,
    height: tunnel.height,
    slope: direction * tunnelSlope,
    sticky: false,
    trimStyle: 'plain',
  }
  const [winX, winZ] = tunnelDiagonalPoint(display.winCenterS, direction * halfW)
  return {
    ...wall,
    holes: [
      {
        name: 'display',
        u: wallCoordinates(wall, [winX, wall.center[1], winZ]),
        bottom: tunnelDisplayWindow.bottom,
        height: tunnelDisplayWindow.top,
        width: tunnelDisplayWindow.width,
        glassThickness: tunnelDisplayWindow.glassThickness,
        profile: 'rectangle',
      },
    ],
  }
}
const toRoomWall = (wall: Wall): RoomWall => {
  const {id: _id, room: _room, holes, center: [x, y, z], ...rest} = wall
  return {
    ...rest,
    center: [x - originX, y - originY, z - originZ],
    ...holes ? {holes: Object.fromEntries(holes.map(({name = 'hole', ...hole}) => [name, hole]))} : {},
  }
}

export default {
  north_west: toRoomWall(levelSegmentWall('exhibition-north_west', w0, w1, tunnel.northY, -1)),
  west_north_stub: toRoomWall(levelSegmentWall('exhibition-west_north_stub', w1, wSlopeStart, tunnel.northY, -1)),
  west: toRoomWall(diagonalWall('west')),
  west_south_stub: toRoomWall(levelSegmentWall('exhibition-west_south_stub', wSlopeEnd, w2, tunnel.southY, -1)),
  south_west: toRoomWall(levelSegmentWall('exhibition-south_west', w2, w3, tunnel.southY, -1)),
  north_east: toRoomWall(levelSegmentWall('exhibition-north_east', e0, e1, tunnel.northY, 1)),
  east_north_stub: toRoomWall(levelSegmentWall('exhibition-east_north_stub', e1, eSlopeStart, tunnel.northY, 1)),
  east: toRoomWall(diagonalWall('east')),
  east_south_stub: toRoomWall(levelSegmentWall('exhibition-east_south_stub', eSlopeEnd, e2, tunnel.southY, 1)),
  south_east: toRoomWall(levelSegmentWall('exhibition-south_east', e2, e3, tunnel.southY, 1)),
  // The staff stairways’ walls, from the doors at the balcony’s ends down to the displays.
  ...localWalls('exhibition', roomOrigins.exhibition, tunnelDisplays.flatMap(({stairway}) => stairway.walls), {
    stairs_west_display_entry: ['door'],
    stairs_east_display_entry: ['door'],
  }),
} satisfies Record<string, RoomWall>
