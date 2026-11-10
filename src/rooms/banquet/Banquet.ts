import {Geofence} from 'geofency'

import {banquet} from '#src/lib/gallery/banquet.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {size, height} = banquet

export default class Banquet extends Room {
  override readonly air = floorBox(size, 0, height)
  override readonly description = 'A change of perspective is encouraged.'
  // Everything over its floor plan from the slab up; it comes before the Salon, so the wall they share is the Banquet’s.
  override readonly fence = new Geofence([{
    ...footprint([this.air]),
    floor: groundFenceY,
  }])
  override readonly height = height
  override readonly id = 'banquet'
  override readonly size = size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Banquet',
      mood: 'banquet',
      frame: ['banquet-perspective', 'banquet-deco', 'banquet-checker'],
      cameras,
      spawns,
      lamps,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
