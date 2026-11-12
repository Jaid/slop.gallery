import {Geofence} from 'geofency'

import {tunnelCenter, tunnelChunks} from '#src/lib/gallery/exhibitionTunnel.ts'
import {floorChunks} from '#src/lib/gallery/floorPolygons.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'

import Room from '../base/Room.ts'
import chunkBoxes from '../lib/chunkBoxes.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import walls from './walls.ts'

/** The air along the tunnel’s diagonal and round the displays and their stairways is cut into chunks whose boxes reach at most this far past their askew walls. */
const slack = 0.35

/** The tunnel from the middle of Moonfall’s north wall diagonally down to the middle of the Oculus’ south wall, with a display behind glass on either side and the staff stairways down to them from the Oculus’ balcony. Laid out around the middle of the tunnel’s sloping floor. */
export default class Exhibition extends Room {
  override readonly air = chunkBoxes([
    ...tunnelChunks(slack),
    // The displays, with their stairways from the balcony.
    ...tunnelDisplays.flatMap(({stairway}) => stairway.air.flatMap(({polygon, bottom, top}) => floorChunks([polygon], bottom, top - bottom, slack))),
  ], tunnelCenter)
  override readonly description = 'Sealed behind glass. Lit like evidence.'
  // Everything under the tunnel, the displays and their stairways, chunk by chunk, up into the slab of the ground floor; it comes after the Oculus, which keeps the balcony in front of the stairways’ doors, and after Moonfall.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    ceiling: groundFenceY - tunnelCenter[1],
  })))
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
