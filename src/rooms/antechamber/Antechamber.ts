import type {RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'
import hsl from 'okhsl'

import {antechamberLanding, antechamberSize, antechamberStairs, antechamberZ, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

const riseFootZ = antechamberStairs.end[2]
const riseEndZ = antechamberLanding.center[1] + antechamberLanding.size[1] / 2

/** The stained dome between two lower lantern halls. */
export default class Antechamber extends Room {
  override readonly air = [
    // Up to the crown of the dome.
    floorBox(antechamberSize, 0, antechamberDomeCrownY),
    ...Object.values(stairHalls).map(({center, size}) => floorBox(size, 0, stairHallHeight, [center[0], center[1] - antechamberZ])),
    // The flight up out of the solar hall and its landing, up to the landing’s ceiling.
    floorBox([antechamberStairs.width, riseEndZ - riseFootZ], 0, antechamberLanding.floorY + antechamberLanding.height, [antechamberStairs.end[0], (riseFootZ + riseEndZ) / 2 - antechamberZ]),
  ]
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over its floor plans from the slab up, the dome included.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = 7
  override readonly id = 'antechamber'
  override readonly size = antechamberSize
  // Just north of the middle, looking south across the dome.
  override readonly spawn = {
    position: [0, 0.04, -1.1],
    yaw: -Math.PI,
    pitch: 0,
  } satisfies RoomSpawn

  constructor() {
    super({
      title: 'The Antechamber',
      mood: 'antechamber',
      frame: ['kumiko'],
      cameras,
      // A lamp under the lantern of either hall: moonlight in the lunar hall down to Moonfall, sunlight in the solar hall up toward the floor above.
      lamps: Object.fromEntries((['west', 'east'] as const).map(side => [side, {
        position: [stairHalls[side].center[0], stairHallHeight - 0.65, 0],
        tint: side === 'east' ? hsl.integer(246, 30, 87) : hsl.integer(79, 100, 90.4),
        strength: 20,
        range: 9,
      }])),
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
