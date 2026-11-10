import type {FloorSize, RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

const size: FloorSize = [8, 8]

/** Lit through the windows of its dome, without lamps of its own. */
export default class Antechamber extends Room {
  // Up to the crown of the dome.
  override readonly air = floorBox(size, 0, antechamberDomeCrownY)
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over its floor plan from the slab up, the dome included.
  override readonly fence = new Geofence([{
    ...footprint([this.air]),
    floor: groundFenceY,
  }])
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = 7
  override readonly id = 'antechamber'
  override readonly size = size
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
      frame: ['adam', 'sevres'],
      cameras,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
