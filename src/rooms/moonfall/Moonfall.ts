import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {moonfallCrater, moonfallHeight} from '#src/lib/gallery/moonfall/config.ts'
import {craterTerrain} from '#src/lib/gallery/moonfall/CraterTerrain.ts'
import {stairTurn} from '#src/lib/gallery/staircase.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import ambienceEmitters from './ambienceEmitters.ts'
import cameras from './cameras.ts'
import fences, {stairway} from './fences.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import upperMap from './upperMap.svg?raw'
import walls from './walls.ts'

const {moonfall: plan} = lowerGallery
const bottom = craterTerrain.lowest()

/** Laid out around the middle of its floor plan, at the height of its slate floor. */
export default class Moonfall extends Room {
  // Reaches down to the deepest air in the crater.
  override readonly air = floorBox(plan.size, bottom, moonfallHeight - bottom)
  override readonly description = 'Down the stairs. Out of the ordinary.'
  override readonly fence = new Geofence([
    // Everything under its floor plan, up to the ground floor’s fences in the slab over its ceiling.
    {
      ...footprint([this.air]),
      ceiling: groundFenceY - lowerGallery.floorY,
    },
    // The stairway up to the Antechamber’s lunar hall, east of the hall, at every height.
    ...stairway,
  ])
  override readonly height = moonfallHeight
  override readonly id = 'moonfall'
  override readonly size = plan.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'Moonfall',
      mood: 'moonfall',
      frame: ['regolith', 'meteorite', 'orbit'],
      portraitArea: 60_000,
      cameras,
      fences,
      spawns,
      ambience: ambienceEmitters,
      lamps,
      skybox: null,
      // The room lies under its own ceiling, so the sun never lights its air, and the turning meteorite never redraws the sun’s shadow map.
      sunTight: true,
      volumetricSun: 0,
      walls,
      map,
      // The upper flight down from the Antechamber’s lunar hall and the near half of the landing, cut across the middle of the turn.
      upperMap: {
        from: stairTurn.top - lowerGallery.floorY,
        map: upperMap,
      },
    })
  }

  /** The crater’s soft ground in the middle muffles every step. */
  override groundSurface([x, , z]: Vec3): GroundSurface {
    return Math.hypot(x, z) <= moonfallCrater.radius + 1e-6 ? 'fabric' : 'generic'
  }
}
