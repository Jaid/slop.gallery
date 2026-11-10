import type {RoomSpawn} from '../base/Room.ts'
import type KnotLayout from 'knot-materials/KnotLayout.ts'
import type {Box3} from 'three/webgpu'

import {Geofence} from 'geofency'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import {planWall} from '../lib/walls.ts'

/** Knottingham’s exhibition hall, laid out around the middle of its floor. Its size follows the Knots the URL selects. */
export default class Arena extends Room {
  override readonly air: Box3
  override readonly description = 'Light, motion and impossible materials.'
  override readonly fence: Geofence
  override readonly id = 'arena'
  override readonly spawn: RoomSpawn

  constructor(layout: KnotLayout) {
    const [width, height, depth] = layout.size
    const size = [width, depth] as const
    super({
      title: 'Arena',
      mood: 'arena',
      // Four plain walls around the rows, which artworks may hang on.
      walls: {
        north: planWall(size, 'north', height),
        south: planWall(size, 'south', height),
        west: planWall(size, 'west', height),
        east: planWall(size, 'east', height),
      },
    })
    const [x, , z] = layout.center
    this.air = floorBox([width, depth], 0, height)
    // Its whole floor plan at every height, as it is all there is.
    this.fence = new Geofence([footprint([this.air])])
    // At the west end of the first row, looking north along the rows.
    this.spawn = {
      position: [-layout.rowHalfWidth - x, 0.04, layout.firstRowZ + 2.75 - z],
      yaw: 0,
      pitch: 0,
    }
  }
}
