import {Geofence} from 'geofency'

import {floorChunks} from '#src/lib/gallery/floorPolygons.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery, {tunnelCenter, tunnelSegments} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {tunnel} = lowerGallery
const [originX, originY, originZ] = tunnelCenter
const segmentFloorRange = {
  north: [tunnel.northY, tunnel.northY + tunnel.height],
  diagonal: [tunnel.northY, tunnel.southY + tunnel.height],
  south: [tunnel.southY, tunnel.southY + tunnel.height],
} as const

/** The beveled sloping tunnel from Moonfall down to the Oculus, with a display behind glass on either side and asymmetric staff stairways down to them from the Oculus’ balcony. Laid out around the middle of the diagonal gallery’s floor. */
export default class Exhibition extends Room {
  override readonly air = [
    ...tunnelSegments.flatMap(({id, polygon}) => {
      const [bottom, top] = segmentFloorRange[id]
      return floorChunks([polygon], bottom, top - bottom, 0.2).map(({min, max}) => floorBox(
        [max[0] - min[0], max[2] - min[2]],
        min[1] - originY,
        max[1] - min[1],
        [(min[0] + max[0]) / 2 - originX, (min[2] + max[2]) / 2 - originZ],
      ))
    }),
    // The displays, with their stairways from the balcony.
    ...tunnelDisplays.flatMap(({stairway}) => stairway.air.map(air => floorBox(air.size, air.bottom - originY, air.top - air.bottom, [air.center[0] - originX, air.center[1] - originZ]))),
  ]
  override readonly description = 'Sealed behind glass. Lit like evidence.'
  // Each chunk’s footprint up into the slab of the ground floor, padded slightly so diagonal strips share no 1-ULP gap.
  override readonly fence = new Geofence(this.air.map(box => {
    const {x, z, x2, z2} = footprint([box])
    return {
      x: x - 1e-4,
      z: z - 1e-4,
      x2: x2 + 1e-4,
      z2: z2 + 1e-4,
      ceiling: groundFenceY - originY,
    }
  }))
  override readonly id = 'exhibition'
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Exhibition',
      mood: 'exhibition',
      frame: ['vitrine', 'evidence', 'containment'],
      cameras,
      spawns,
      lamps,
      skybox: 'sky',
      walls,
      map,
    })
  }
}
