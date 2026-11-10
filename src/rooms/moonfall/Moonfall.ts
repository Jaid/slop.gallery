import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {moonfallCrater} from '#src/lib/gallery/moonfall/config.ts'
import {craterTerrain} from '#src/lib/gallery/moonfall/CraterTerrain.ts'
import {stairwayFootprint} from '#src/lib/gallery/staircase.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import ambienceEmitters from './ambienceEmitters.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {moonfall: plan} = lowerGallery
const bottom = craterTerrain.lowest()

/** Laid out around the middle of its floor plan, at the height of its slate floor. */
export default class Moonfall extends Room {
  // Reaches down to the deepest air in the crater.
  override readonly air = floorBox(plan.size, bottom, 5.8 - bottom)
  override readonly description = 'Down the stairs. Out of the ordinary.'
  override readonly fence = new Geofence([
    // Everything under its floor plan, up to just over its ceiling; it comes before the Corridor, whose stairs climb over a corner of it.
    {
      ...footprint([this.air]),
      ceiling: 6,
    },
    // The stairway up to the Antechamber, at every height.
    {
      x: stairwayFootprint.x - plan.center[0],
      z: stairwayFootprint.z - plan.center[1],
      x2: stairwayFootprint.x2 - plan.center[0],
      z2: stairwayFootprint.z2 - plan.center[1],
    },
  ])
  override readonly height = 5.8
  override readonly id = 'moonfall'
  override readonly size = plan.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'Moonfall',
      mood: 'moonfall',
      frame: ['meteorite', 'orbit', 'regolith'],
      portraitArea: 60_000,
      cameras,
      spawns,
      ambience: ambienceEmitters,
      lamps,
      skybox: null,
      // The room lies under its own ceiling, so the sun never lights its air.
      volumetricSun: 0,
      walls,
      map,
    })
  }

  /** The crater’s soft ground in the middle muffles every step. */
  override groundSurface([x, , z]: Vec3): GroundSurface {
    return Math.hypot(x, z) <= moonfallCrater.radius + 1e-6 ? 'fabric' : 'generic'
  }
}
