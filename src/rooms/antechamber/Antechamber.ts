import type {FloorSize, RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import {antechamberEastWing, antechamberHall, antechamberWestWing, antechamberWing, moonfallLandingSouth, moonfallPassage} from '#src/lib/gallery/antechamber.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import {galleryStairs, galleryStairwayFootprint} from '#src/lib/gallery/staircase.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

const hall: FloorSize = antechamberHall.size
const wing: FloorSize = antechamberWing.size
const west = [antechamberWestWing.center[0], antechamberWestWing.center[1] - 12] as const
const east = [antechamberEastWing.center[0], antechamberEastWing.center[1] - 12] as const
const passage = [moonfallPassage.west + moonfallPassage.width / 2, (moonfallPassage.north + moonfallPassage.south) / 2 - 12] as const
const landing = [moonfallPassage.west + moonfallPassage.width / 2, (moonfallPassage.south + moonfallLandingSouth) / 2 - 12] as const

/** The hall under the dome, with a square wing on either side. The west wing leads down to Moonfall and the east wing up to a short gallery. */
export default class Antechamber extends Room {
  // The hall up to the crown of the dome, and each wing up to its own flat ceiling.
  override readonly air = [
    floorBox(hall, 0, antechamberDomeCrownY),
    floorBox(wing, 0, antechamberWing.height, west),
    floorBox(wing, 0, antechamberWing.height, east),
    floorBox([moonfallPassage.width, moonfallPassage.south - moonfallPassage.north], 0, antechamberWing.height, passage),
    floorBox([moonfallPassage.width, moonfallPassage.landing], 0, antechamberWing.height, landing),
    // The stairway up to the gallery, from under its lowest tread to the headroom over its landing.
    floorBox([galleryStairwayFootprint.x2 - galleryStairwayFootprint.x, galleryStairwayFootprint.z2 - galleryStairwayFootprint.z], -1, galleryStairs.start[1] + antechamberWing.height + 1, [(galleryStairwayFootprint.x + galleryStairwayFootprint.x2) / 2, (galleryStairwayFootprint.z + galleryStairwayFootprint.z2) / 2 - 12]),
  ]
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over the hall and both wings from the slab up, the dome and the gallery stairway included.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  // The hall is taller than the other upper rooms, a meter short of a cube; the wings stop at their own ceiling.
  override readonly height = antechamberHall.height
  override readonly id = 'antechamber'
  override readonly size = hall
  // Just north of the hall’s middle, looking south toward the wings.
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
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
