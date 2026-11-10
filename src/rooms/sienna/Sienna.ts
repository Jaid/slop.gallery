import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import sienna, {siennaRugSize, siennaVestibule} from '#src/lib/gallery/sienna.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

export default class Sienna extends Room {
  override readonly air = [
    floorBox(sienna.size, 0, sienna.height),
    // The vestibule west of its arch, lower, where the Corridor arrives.
    floorBox(siennaVestibule.size, 0, siennaVestibule.height, [siennaVestibule.center[0] - sienna.center[0], siennaVestibule.center[1] - sienna.center[1]]),
  ]
  override readonly description = 'Low light. Rich textures. Questionable company.'
  // Everything over its floor plan and its vestibule’s from the slab up; it comes before the Corridor, so the vestibule’s wall with the arch between them is the Sienna’s.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  override readonly height = sienna.height
  override readonly id = 'sienna'
  override readonly size = sienna.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Sienna',
      mood: 'sienna',
      frame: ['velvet', 'burl', 'leather'],
      cameras,
      spawns,
      lamps,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }

  /** The rug in the middle muffles every step, the floorboards around it sound hollow. */
  override groundSurface([x, , z]: Vec3): GroundSurface {
    return Math.abs(x) <= siennaRugSize[0] / 2 + 1e-6 && Math.abs(z) <= siennaRugSize[1] / 2 + 1e-6 ? 'fabric' : 'hollow'
  }
}
