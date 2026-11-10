import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery, {tunnelCenter} from '#src/lib/gallery/lowerGallery.ts'
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

/** The sloping tunnel from Moonfall down to the Oculus, with a display behind glass on either side and the staff stairways down to them from the Oculus’ balcony. Laid out around the middle of the tunnel’s floor. */
export default class Exhibition extends Room {
  override readonly air = [
    // From the tunnel’s low north end to the top of its high south end.
    floorBox([tunnel.width, tunnel.southZ - tunnel.northZ], tunnel.northY - originY, tunnel.southY + tunnel.height - tunnel.northY, [tunnel.x - originX, 0]),
    // The displays, with their stairways from the balcony.
    ...tunnelDisplays.flatMap(({stairway}) => stairway.air.map(air => floorBox(air.size, air.bottom - originY, air.top - air.bottom, [air.center[0] - originX, air.center[1] - originZ]))),
  ]
  override readonly description = 'Sealed behind glass. Lit like evidence.'
  // Everything under the tunnel, the displays and their stairways, up into the slab of the ground floor; it comes after the Oculus, which keeps the middle of the balcony both share.
  override readonly fence = new Geofence([{
    ...footprint(this.air),
    ceiling: groundFenceY - originY,
  }])
  override readonly id = 'exhibition'
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Exhibition',
      mood: 'exhibition',
      frame: ['exhibition-vitrine', 'exhibition-evidence', 'exhibition-containment'],
      cameras,
      spawns,
      lamps,
      skybox: 'sky',
      walls,
      map,
    })
  }
}
