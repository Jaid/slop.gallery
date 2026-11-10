import type {GroundSurface} from '../base/Room.ts'

import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import {vesper} from '#src/lib/gallery/vesper.ts'
import {vesperLanternRidgeY} from '#src/lib/gallery/vesperCeiling.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {size, height} = vesper

/** Lit through the lantern crowning its coved ceiling, without lamps of its own. */
export default class Vesper extends Room {
  // Up to the ridge of the lantern.
  override readonly air = floorBox(size, 0, vesperLanternRidgeY)
  override readonly description = 'Old masters. New misunderstandings.'
  // Everything over its floor plan from the slab up, the cove and the lantern included; it comes before the Forge, so the wall they share is the Vesper’s.
  override readonly fence = new Geofence([{
    ...footprint([this.air]),
    floor: groundFenceY,
  }])
  override readonly height = height
  override readonly id = 'vesper'
  override readonly size = size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Vesper',
      mood: 'vesper',
      frame: ['ripple', 'sgraffito', 'auricular'],
      cameras,
      spawns,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }

  /** The parquet sounds hollow. */
  override groundSurface(): GroundSurface {
    return 'hollow'
  }
}
