import type {FloorSize, RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import reverberation from '#src/lib/audio/transformers/reverberation.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import RoomMood from '#src/lib/moods/RoomMood.ts'

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
      moods: [
        new RoomMood({
          id: 'antechamber',
          title: 'Plaster dome',
          // A small room under a tall plaster dome, which sends a sound back down from its crown.
          transformer: reverberation({
            decay: 1.9,
            predelay: 0.012,
            brightness: [8000, 2200],
            early: [[0.04, 0.38], [0.08, 0.2]],
            wet: 0.19,
          }),
        }),
      ],
      frame: ['antechamber-adam', 'antechamber-sevres'],
      cameras,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
