import {bodyPose} from '#src/lib/gallery/actions.ts'
import world from '#src/worlds/current.ts'

export type GeofenceQuery = {
  /** the position in world meters; by default the player’s place, which the game follows through the fences itself: the capsule’s middle, or, flying, the eyes */
  position?: {
    x: number
    y: number
    z: number
  }
}

/** The ids of every fence of the world that holds the position, in the order the world checks them, the rooms’ first, so the first one is the room there wherever a room holds it, or none outside of every fence; see the `get_geofences` tool. */
export default function getGeofences({position}: GeofenceQuery = {}): Array<string> {
  return world.geofences.getMatches(position ? [position.x, position.y, position.z] : bodyPose.place)
}
