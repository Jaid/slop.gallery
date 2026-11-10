import type {GroundSurface} from '../base/Room.ts'

import {Geofence} from 'geofency'

import corridor, {lodgeThreshold} from '#src/lib/gallery/corridor.ts'
import lodge, {lodgeBay, lodgeWindow} from '#src/lib/gallery/lodge.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import ambienceEmitters from './ambienceEmitters.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

/** Laid out around the middle of its square floor plan, at the height of its floor. */
export default class Lodge extends Room {
  override readonly air = [
    floorBox(lodge.size, 0, lodge.height),
    // The Lodge’s half of the doorway passage from the Corridor, north of the bay.
    floorBox(lodgeThreshold.size, corridor.floorY - lodge.floorY, corridor.height, [lodgeThreshold.center[0] - lodge.center[0], lodgeThreshold.center[1] - lodge.center[1]]),
    // The box around the bay off the north wall.
    floorBox(lodgeBay.bounds.size, 0, lodge.height, [lodgeBay.bounds.center[0] - lodge.center[0], lodgeBay.bounds.center[1] - lodge.center[1]]),
  ]
  override readonly description = 'Weathered stone. Warm timber. A way back through the corridor.'
  override readonly fence = new Geofence([
    // The room with its bay, and the doorway’s half by the Corridor, at every height, as nothing lies above or below them.
    footprint([this.air[0], this.air[2]]),
    footprint([this.air[1]]),
    // The window’s deep niche out to its glass in the Corridor’s lining; it comes before the Corridor, whose hall the niche reaches into.
    {
      x: lodgeWindow.tunnelX - lodge.center[0],
      x2: lodgeWindow.roomX - lodge.center[0],
      z: lodgeWindow.z - lodgeWindow.width / 2 - lodge.center[1],
      z2: lodgeWindow.z + lodgeWindow.width / 2 - lodge.center[1],
    },
  ])
  override readonly height = lodge.height
  override readonly id = 'lodge'
  override readonly size = lodge.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'Lodge',
      mood: 'lodge',
      frame: ['lodge-twig', 'lodge-tramp', 'lodge-charred'],
      portraitArea: 7500,
      cameras,
      spawns,
      ambience: ambienceEmitters,
      lamps,
      skybox: 'sky',
      sunlit: false,
      volumetricSun: 0,
      slots,
      walls,
      map,
    })
  }

  /** The planks sound hollow. */
  override groundSurface(): GroundSurface {
    return 'hollow'
  }
}
