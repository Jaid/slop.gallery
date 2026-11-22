import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Room} from '#src/rooms/index.ts'

import {lazy} from 'react'

import {FloorPlanPlacementSpace} from '#src/lib/placement/FloorPlanPlacementSpace.ts'
import artworks from '#src/worlds/gallery/artworks.ts'

import World from '../../base/World.ts'
import {worlds} from '../../index.ts'

const minimap = lazy(() => import('#component/SandboxMinimap'))
/** how far the player’s body keeps its middle from the walls */
const bodyRadius = 0.6

/** a room the Sandbox can hold, with a level floor at the height of its origin */
export type SandboxRoom = Room & {
  /** How high the room’s air reaches over the point of its floor plan, relative to its origin: up to its ceiling, or the top of its walls without one. */
  ceilingAt: (x: number, z: number) => number
  /** how high the room’s air reaches over its floor at most, where its ceiling is highest, or the top of its walls without one */
  readonly clearHeight: number
  /** Whether the position, relative to the room’s origin, lies on the room’s floor, at least `margin` meters from its edges, which are its walls’ center lines where it has walls. */
  floorContains: (position: Vec3, margin?: number) => boolean
}

/**
 * A world to try things in: a single room, with a few of the gallery’s default works on its walls and its floor plan as the map.
 * The room is the Cell, or the Studio for `?room=studio`, and only the modules of the one the page opens load, see `load.ts`.
 */
export default abstract class Sandbox<Kind extends SandboxRoom = SandboxRoom> extends World<Kind> {
  // The gallery’s default works, of which the room’s slots take as many as fit, drawn by the seed.
  override readonly artworks = artworks
  override readonly id = 'sandbox'
  override readonly Minimap = minimap
  // Artworks hang on any of the room’s walls, and lost ones return to its spawn.
  override readonly placement: FloorPlanPlacementSpace

  /** @param origin where the room’s origin lies in the world, the world’s own by default */
  constructor(room: Kind, origin: Vec3 = [0, 0, 0]) {
    super(worlds.sandbox, [[room, origin]])
    const [placed] = this.rooms
    const [x, , z] = placed.spawn.position
    this.placement = new FloorPlanPlacementSpace(this.walls, (pointX, pointZ) => room.floorContains(placed.toLocal([pointX, 0, pointZ])), room.clearHeight, [x, 1, z])
  }

  /** Anywhere on the room’s floor a body fits, from the floor up to the ceiling, or the top of the walls. */
  override contains(position: Vec3) {
    const placed = this.room(this.defaultRoom)
    const local = placed.toLocal(position)
    const [x, y, z] = local
    return y >= -0.2 && y < placed.room.ceilingAt(x, z) && placed.room.floorContains(local, bodyRadius)
  }

  /** The room’s floor is level everywhere, so every floor mirrors in one plane. */
  override floorHeight(_position: Vec3) {
    return 0
  }

  /** How far a ray from the origin travels until it meets a wall, a little farther than the wall itself, and on through the openings. */
  override wallDistance(origin: Vec3, direction: Vec3) {
    const hit = this.placement.findPlacement(origin, direction, 0, 0, [])
    return hit ? Math.hypot(...hit.position.map((value, index) => value - origin[index]) as Vec3) + 0.3 : Infinity
  }
}
