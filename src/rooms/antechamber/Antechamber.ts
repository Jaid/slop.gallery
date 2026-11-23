import type {RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import {antechamberSize, antechamberZ, eastStair, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

/** The stained dome between two lower lantern halls. */
export default class Antechamber extends Room {
  // Up to the crown of the dome.
  override readonly air = [
    floorBox(antechamberSize, 0, antechamberDomeCrownY),
    ...Object.values(stairHalls).map(({center, size}) => floorBox(size, 0, stairHallHeight, [center[0], center[1] - antechamberZ])),
    floorBox([eastStair.length, eastStair.width], 0, eastStair.start[1] + eastStair.headroom, [(eastStair.start[0] + eastStair.end[0]) / 2, 0]),
  ]
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over its floor plan from the slab up, the dome included.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = 7
  override readonly id = 'antechamber'
  override readonly size = antechamberSize
  // Just north of the middle, looking south toward the stairs.
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
      lamps: Object.fromEntries((['east', 'west'] as const).map(side => [side, {
        position: [stairHalls[side].center[0], stairHallHeight - 0.65, 0],
        tint: side === 'west' ? '#cedce9' : '#ffdfac',
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
