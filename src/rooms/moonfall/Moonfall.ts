import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {moonfallCrater, moonfallHeight} from '#src/lib/gallery/moonfall/config.ts'
import {craterTerrain} from '#src/lib/gallery/moonfall/CraterTerrain.ts'
import {approachFootprints, stairTurn, stairwayFootprint} from '#src/lib/gallery/staircase.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import ambienceEmitters from './ambienceEmitters.ts'
import cameras from './cameras.ts'
import fences from './fences.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import upperMap from './upperMap.svg?raw'
import walls from './walls.ts'

const {moonfall: plan} = lowerGallery
const bottom = craterTerrain.lowest()
const groundFloor = groundFenceY - lowerGallery.floorY

/** Laid out around the middle of its floor plan, at the height of its slate floor. */
export default class Moonfall extends Room {
  // Reaches from the deepest air in the crater up to the underside of the raised ceiling slab.
  override readonly air = floorBox(plan.size, bottom, moonfallHeight - bottom)
  override readonly description = 'Down the stairs. Out of the ordinary.'
  override readonly fence = new Geofence([
    // Everything under its floor plan, up into the ground-floor slab above.
    {
      ...footprint([this.air]),
      ceiling: groundFloor,
    },
    // The curved level approach at ground level over Moonfall’s ceiling.
    ...approachFootprints.map(({x, z, x2, z2}) => ({
      x: x - plan.center[0],
      z: z - plan.center[1],
      x2: x2 - plan.center[0],
      z2: z2 - plan.center[1],
      floor: groundFloor,
    })),
    // Both descending flights and the U-turn landing east of Moonfall’s east wall, at every height.
    {
      x: stairwayFootprint.x - plan.center[0],
      z: stairwayFootprint.z - plan.center[1],
      x2: stairwayFootprint.x2 - plan.center[0],
      z2: stairwayFootprint.z2 - plan.center[1],
    },
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
      // The curved ground-level approach, upper flight and U-turn landing down to the turn’s elevation.
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
