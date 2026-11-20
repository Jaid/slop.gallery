import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {corridorLanding, corridorLandingPaving} from '#src/lib/gallery/corridor.ts'
import {floorChunks} from '#src/lib/gallery/floorPolygons.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import sienna, {siennaRugSize, siennaVestibule} from '#src/lib/gallery/sienna.ts'

import Room from '../base/Room.ts'
import chunkBoxes from '../lib/chunkBoxes.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

/** The Corridor’s landing beyond the vestibule’s west arch, as far as it is laid with the Sienna’s boards, is cut into chunks whose boxes reach at most this far onto the flight’s head tread. */
const landingSlack = 0.1

export default class Sienna extends Room {
  override readonly air = [
    floorBox(sienna.size, 0, sienna.height),
    // The vestibule south of its arch by the south-west corner, lower, where the Corridor arrives.
    floorBox(siennaVestibule.size, 0, siennaVestibule.height, [siennaVestibule.center[0] - sienna.center[0], siennaVestibule.center[1] - sienna.center[1]]),
    // The landing beyond, up to the Corridor’s flight’s head tread, under the Corridor’s lining.
    ...chunkBoxes(floorChunks(corridorLandingPaving, corridorLanding.floorY, corridorLanding.height, landingSlack), [sienna.center[0], sienna.floorY, sienna.center[1]]),
  ]
  override readonly description = 'Low light. Rich textures. Questionable company.'
  // Everything over its floor plan, its vestibule’s and its boards on the landing from the slab up; it comes before the Corridor, so the vestibule’s wall with the arch between them and the edge of the landing’s boards are the Sienna’s.
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
      frame: ['velvet', 'leather'],
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
