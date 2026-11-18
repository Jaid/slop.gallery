import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import salon from '#src/lib/gallery/salon.ts'
import {salonRoofTopY} from '#src/lib/gallery/salonRoof.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import walls from './walls.ts'

/** Lit through its skylight, without lamps of its own. */
export default class Salon extends Room {
  override readonly air = floorBox(salon.size, 0, salonRoofTopY)
  override readonly description = 'Hung frame to frame. Judged elbow to elbow.'
  // Everything over its floor plan from the slab up, the skylight included.
  override readonly fence = new Geofence([{
    ...footprint([this.air]),
    floor: groundFenceY,
  }])
  override readonly height = salonRoofTopY
  override readonly id = 'salon'
  override readonly size = salon.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Salon',
      mood: 'salon',
      frame: ['whistler', 'auricular'],
      cameras,
      spawns,
      skybox: 'sky',
      walls,
      map,
    })
  }
}
