import type {Wall, WallOpening} from '#src/lib/placement/wallGeometry.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {Vec3} from './types.ts'
import type {Frustum, Matrix4, Object3D} from 'three/webgpu'

import {Box3, Vector3} from 'three/webgpu'

import {openingTop, wallCoordinates, wallOffset, wallPosition} from '#src/lib/placement/wallGeometry.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import relations, {openings} from '#src/worlds/gallery/relations.ts'

import lobby from './lobby.ts'
import {vesperLanternHalf, vesperLanternRidgeY, vesperLanternSillY} from './vesperCeiling.ts'

/** a rectangle on screen in normalized device coordinates: left, bottom, right, top */
export type ScreenRect = readonly [number, number, number, number]
type Portal = {
  box: Box3
  rooms: readonly [RoomId, RoomId]
}

/** how many openings deep line of sight reaches in the gallery: from the Lobby down through its glazed floor into the Oculus and on through the Bastion into the Lodge, or from the Antechamber down to Moonfall and on through the Exhibition into the Oculus */
const sightDepth = 3
// Doorframes, trims and the reveal of thick walls stay inside the portal.
const portalDepth = 0.8
/** how far a box may reach in front of a wall and still count as lying behind it */
const behindTolerance = 0.01
/**
 * Whether the box’s floor plan lies behind the wall, straight behind the hole: its middle across from the hole. Its middle counts as one of its corners, since the corners of a box around a round room, like the air of a round vestibule, lie behind its ring wall.
 * Behind a ring wall lies everything outside it, like the room a round vestibule opens off, which only lies straight behind its own arch.
 */
const behindHole = (wall: Wall, hole: WallOpening, {min, max}: Box3) => {
  const middle: Vec3 = [(min.x + max.x) / 2, 0, (min.z + max.z) / 2]
  for (const point of [middle, ...[min.x, max.x].flatMap(x => [min.z, max.z].map((z): Vec3 => [x, 0, z]))]) {
    if (wallOffset(wall, point) > behindTolerance) {
      return false
    }
  }
  return Math.abs(wallCoordinates(wall, middle) - hole.u) <= hole.width / 2
}
/** The floor mirrors what lies above it below its surface, and the reflection must show what lies behind an opening too. */
const withReflection = (box: Box3, bottom: number, top: number) => box.expandByPoint(new Vector3(box.min.x, bottom - (top - bottom), box.min.z)).expandByPoint(new Vector3(box.max.x, top, box.max.z))
const holeBox = (wallId: string, name: string) => {
  const wall = slopGallery.walls.find(value => value.id === wallId)
  const hole = wall?.holes?.find(value => value.name === name)
  if (!wall || !hole) {
    throw new Error(`The wall ${wallId} has no hole “${name}”.`)
  }
  const bottom = wall.center[1] + (hole.bottom ?? 0)
  const top = wall.center[1] + openingTop(hole, hole.u)
  const box = new Box3
  const from = hole.u - hole.width / 2
  const to = hole.u + hole.width / 2
  const coordinates = [from, to]
  const radius = wall.curveRadius
  if (radius) {
    // A curved opening can bulge past both jambs. Include every world-axis extremum of its inner and outer arcs, not just their endpoints; otherwise the camera can pass the portal while still inside its owner room’s air.
    const quarterTurn = Math.PI / 2
    const angles = [from / radius - wall.rotation, to / radius - wall.rotation]
    for (let quadrant = Math.ceil(Math.min(...angles) / quarterTurn); quadrant <= Math.floor(Math.max(...angles) / quarterTurn); quadrant++) {
      coordinates.push(radius * (wall.rotation + quadrant * quarterTurn))
    }
  }
  for (const u of coordinates) {
    for (const offset of [-portalDepth, portalDepth]) {
      box.expandByPoint(new Vector3(...wallPosition(wall, u, bottom, offset)))
    }
  }
  withReflection(box, bottom, top)
  // A room’s air behind its own wall’s opening is a threshold it owns in the passage beyond, like the Lodge’s half of the doorway passage to the Corridor. A camera there stands in that room alone, but must still see through the opening, however far the threshold reaches past the portal’s depth.
  for (const threshold of slopGallery.roomById(wall.room)?.air ?? []) {
    if (behindHole(wall, hole, threshold)) {
      box.union(withReflection(threshold.clone(), threshold.min.y, threshold.max.y))
    }
  }
  return box
}
/** the glass of the Vesper’s lantern, through which the vault of the Lobby next door rises against the sky, or with `mirrored` its reflection in the floor */
const vesperLanternBox = (mirrored: boolean) => {
  const vesper = slopGallery.room('vesper')
  const [halfX, halfZ] = vesperLanternHalf(vesper.size)
  const [x, z] = vesper.center
  const [bottom, top] = mirrored ? [-vesperLanternRidgeY, -vesperLanternSillY] : [vesperLanternSillY, vesperLanternRidgeY]
  return new Box3(new Vector3(x - halfX, vesper.floorY + bottom, z - halfZ), new Vector3(x + halfX, vesper.floorY + top, z + halfZ))
}

export const portals: Array<Portal> = [
  ...openings.map(({rooms: pair, holes}) => ({
    rooms: pair,
    box: holes.map(([wallId, name]) => holeBox(wallId, name)).reduce((a, b) => a.union(b)),
  })),
  {
    // The glazed Lobby floor looks down into the Oculus.
    rooms: ['lobby', 'oculus'],
    box: new Box3(new Vector3(lobby.opening.center[0] - lobby.opening.size[0] / 2, -1, lobby.opening.center[1] - lobby.opening.size[1] / 2), new Vector3(lobby.opening.center[0] + lobby.opening.size[0] / 2, 0.5, lobby.opening.center[1] + lobby.opening.size[1] / 2)),
  },
  ...[false, true].map(mirrored => ({
    rooms: ['vesper', 'lobby'] as const,
    box: vesperLanternBox(mirrored),
  })),
]

/** the boxes of each room’s air, a room’s air can take several (like the Corridor’s strips round the Lodge’s bay, its hall and its stair flight up to the Sienna); they reach below the floor for its reflection */
export const roomBoxes: ReadonlyArray<{
  box: Box3
  floorY: number
  id: RoomId
}> = slopGallery.rooms.flatMap(({id, air, floorY}) => air.map(({min, max}) => ({
  id,
  floorY,
  box: new Box3(new Vector3(min.x, min.y - 1, min.z), new Vector3(max.x, max.y + 0.2, max.z)),
})))

const point = new Vector3

type Owned = {
  /** an object the player can carry from room to room, which the room it is in owns, see {@link updatePickupRoom} */
  pickup?: boolean
  /** the room that owns the object and everything below it */
  room?: string
}

/** the room whose box contains the position; undefined in passages between rooms and where boxes overlap */
export function roomContaining([x, y, z]: Vec3) {
  point.set(x, y, z)
  let result: RoomId | undefined
  for (const {id, box} of roomBoxes) {
    if (!box.containsPoint(point)) {
      continue
    }
    if (result && result !== id) {
      return
    }
    result = id
  }
  return result
}

/**
 * The rooms the camera can see from its room: a neighbor counts when the opening to it lies in the frustum, and a room behind a neighbor when both openings do, up to {@link sightDepth} openings deep.
 */
export function visibleRooms(room: RoomId, frustum: Frustum) {
  const result = new Set<RoomId>([room])
  const through = (from: RoomId, depth: number) => {
    for (const portal of portals) {
      const index = portal.rooms.indexOf(from)
      if (index === -1 || !frustum.intersectsBox(portal.box)) {
        continue
      }
      const next = portal.rooms[1 - index]
      if (next === room) {
        continue
      }
      result.add(next)
      if (depth > 1) {
        through(next, depth - 1)
      }
    }
  }
  through(room, sightDepth)
  return result
}

/** the rooms whose boxes contain the position, and in a passage the rooms on both of its ends */
export function roomsAt([x, y, z]: Vec3) {
  point.set(x, y, z)
  const result = new Set<RoomId>
  for (const {id, box} of roomBoxes) {
    if (box.containsPoint(point)) {
      result.add(id)
    }
  }
  if (!result.size) {
    for (const portal of portals) {
      if (portal.box.containsPoint(point)) {
        for (const room of portal.rooms) {
          result.add(room)
        }
      }
    }
  }
  return [...result]
}

/**
 * The room that owns the object, given the room that owns its parent: the room the object names in `userData.room`, which then owns everything below it too, or else its parent’s.
 * World names the room on the root of everything a room builds, walls name their own, the few objects mounted outside of the rooms name theirs, and pickups name the room they are in. Objects of no room, like the lamps’ lights and the player, have none, and neither has a room of another world.
 */
export function ownerRoom(object: Object3D, parentRoom?: RoomId): RoomId | undefined {
  const {room} = object.userData as Owned
  if (room === undefined) {
    return parentRoom
  }
  return Object.hasOwn(relations, room) ? room as RoomId : undefined
}

/** Hands a pickup over to the room it is in now, by its origin. Where that is ambiguous, in a passage or where rooms’ air overlaps, it stays with the room it had, and one that never had a room takes the first one around it. */
export function updatePickupRoom(object: Object3D) {
  const data = object.userData as Owned
  if (!data.pickup) {
    return
  }
  const position = point.setFromMatrixPosition(object.matrixWorld).toArray()
  data.room = roomContaining(position) ?? data.room ?? roomsAt(position)[0]
}

const fullScreen: ScreenRect = [-1, -1, 1, 1]
/** clip-space w below which a corner counts as behind the camera */
const nearW = 1e-5
/** clip-space x, y and w of the box’s corners, by the bits of their index: 1 for the box’s maximum x, 2 for its maximum y and 4 for its maximum z */
const corners = new Float64Array(24)

/** The part of the screen the box covers, or undefined when it is off screen. Of a box reaching behind the camera, only the part in front of it counts, which covers the whole screen when the box surrounds the camera. */
export function screenRect(box: Box3, viewProjection: Matrix4): ScreenRect | undefined {
  const e = viewProjection.elements
  let left = Number.POSITIVE_INFINITY
  let bottom = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.NEGATIVE_INFINITY
  let behind = 0
  for (let index = 0; index < 8; index++) {
    const x = index & 1 ? box.max.x : box.min.x
    const y = index & 2 ? box.max.y : box.min.y
    const z = index & 4 ? box.max.z : box.min.z
    const clipX = e[0] * x + e[4] * y + e[8] * z + e[12]
    const clipY = e[1] * x + e[5] * y + e[9] * z + e[13]
    const w = e[3] * x + e[7] * y + e[11] * z + e[15]
    corners[index * 3] = clipX
    corners[index * 3 + 1] = clipY
    corners[index * 3 + 2] = w
    if (w < nearW) {
      behind++
      continue
    }
    left = Math.min(left, clipX / w)
    bottom = Math.min(bottom, clipY / w)
    right = Math.max(right, clipX / w)
    top = Math.max(top, clipY / w)
  }
  if (behind === 8) {
    return
  }
  // The part in front of the camera is bounded by the corners in front and the points where the box’s edges pass behind the camera.
  for (let from = 0; behind && from < 8; from++) {
    for (let bit = 1; bit < 8; bit <<= 1) {
      if (from & bit) {
        continue
      }
      const a = from * 3
      const b = (from | bit) * 3
      if (corners[a + 2] < nearW === corners[b + 2] < nearW) {
        continue
      }
      const t = (nearW - corners[a + 2]) / (corners[b + 2] - corners[a + 2])
      const screenX = (corners[a] + (corners[b] - corners[a]) * t) / nearW
      const screenY = (corners[a + 1] + (corners[b + 1] - corners[a + 1]) * t) / nearW
      left = Math.min(left, screenX)
      bottom = Math.min(bottom, screenY)
      right = Math.max(right, screenX)
      top = Math.max(top, screenY)
    }
  }
  return intersectScreenRects(fullScreen, [left, bottom, right, top])
}

/** the overlap of two screen rectangles, or undefined when they don’t overlap */
export function intersectScreenRects(a: ScreenRect, b: ScreenRect): ScreenRect | undefined {
  const left = Math.max(a[0], b[0])
  const bottom = Math.max(a[1], b[1])
  const right = Math.min(a[2], b[2])
  const top = Math.min(a[3], b[3])
  if (left > right || bottom > top) {
    return
  }
  return [left, bottom, right, top]
}

/**
 * What the camera sees of each room: the rooms it stands in fill the screen, and the rooms behind their openings show through the part of the screen those openings cover, up to {@link sightDepth} openings deep like {@link visibleRooms}.
 * An opening seen through another only shows where both overlap, so rooms beyond a narrow gap or around a corner drop out. Rooms missing from the map are out of sight.
 */
export function visibleRegions(from: ReadonlyArray<RoomId>, viewProjection: Matrix4) {
  const regions = new Map<RoomId, Array<ScreenRect>>(from.map(room => [room, [fullScreen]]))
  const portalRects = new Map<Portal, ScreenRect | undefined>
  const through = (room: RoomId, rect: ScreenRect, depth: number) => {
    for (const portal of portals) {
      const index = portal.rooms.indexOf(room)
      const next = portal.rooms[1 - index]
      if (index === -1 || from.includes(next)) {
        continue
      }
      if (!portalRects.has(portal)) {
        portalRects.set(portal, screenRect(portal.box, viewProjection))
      }
      const portalRect = portalRects.get(portal)
      const seen = portalRect && intersectScreenRects(rect, portalRect)
      if (!seen) {
        continue
      }
      const rects = regions.get(next)
      if (rects) {
        rects.push(seen)
      } else {
        regions.set(next, [seen])
      }
      if (depth > 1) {
        through(next, seen, depth - 1)
      }
    }
  }
  for (const room of from) {
    through(room, fullScreen, sightDepth)
  }
  return regions
}
