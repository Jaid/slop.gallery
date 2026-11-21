import type {FloorPolygon} from '#src/lib/gallery/floorPolygons.ts'
import type {GroundSurface, RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import corridor, {corridorBayPaving, corridorHallPaving, corridorLanding, corridorPassage, corridorStairs} from '#src/lib/gallery/corridor.ts'
import {floorChunks} from '#src/lib/gallery/floorPolygons.ts'

import Room from '../base/Room.ts'
import chunkBoxes from '../lib/chunkBoxes.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import fences from './fences.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import upperMap from './upperMap.svg?raw'
import walls from './walls.ts'

const origin = [corridor.center[0], corridor.floorY, corridor.center[1]] as const
/** The air round the Lodge’s bay, down the diagonal flight and over its head is cut into chunks whose boxes reach at most this far past the walls, well short of the bay and the Sienna’s vestibule. */
const slack = 0.35
const passageBoxes = (paving: ReadonlyArray<FloorPolygon>) => chunkBoxes(floorChunks(paving, corridorPassage.floorY, corridorPassage.height, slack), origin)
const bay = passageBoxes(corridorBayPaving)
const hall = passageBoxes(corridorHallPaving)
/** The stair flight up the diagonal, from under its bottom treads to the headroom over its top ones. */
const flight = chunkBoxes(corridorStairs.chunks(slack), origin)
/** Of the landing at the top, only the flight’s head tread; the rest, laid with the Sienna’s boards, is the Sienna’s. */
const head = chunkBoxes(floorChunks([corridorStairs.headOutline()], corridorLanding.floorY, corridorLanding.height, slack), origin)

/** Laid out around the middle of its long hall, at the height of its floor. */
export default class Corridor extends Room {
  override readonly air = [...bay, ...hall, ...flight, ...head]
  override readonly description = 'Timber, turns and the long way back to Sienna.'
  // One span covers the long hall and both elbows. Keep the tighter footprints beside the Lodge and at the flight to Sienna.
  override readonly fence = new Geofence([footprint(hall), ...[...bay, ...flight, ...head].map(box => footprint([box]))])
  override readonly height = corridor.height
  override readonly id = 'corridor'
  override readonly size = corridor.size
  override readonly spawn = {
    position: [0, 0.04, 0],
    yaw: 0,
    pitch: 0,
  } satisfies RoomSpawn

  constructor() {
    super({
      title: 'Corridor',
      mood: 'corridor',
      frame: ['casing'],
      cameras,
      fences,
      lamps,
      skybox: null,
      sunlit: false,
      volumetricSun: 0,
      walls,
      map,
      // The high end of the flight and its landing show beside the Sienna, east of the upper drawing’s west cut.
      upperMap: {
        from: (corridorLanding.floorY - corridor.floorY) / 2,
        map: upperMap,
      },
    })
  }

  /** The boards sound hollow. */
  override groundSurface(): GroundSurface {
    return 'hollow'
  }
}
