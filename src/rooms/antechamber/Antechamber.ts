import type {RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'

import antechamber, {antechamberEastFlight, antechamberEastLanding, antechamberNecks, antechamberPavilions} from '#src/lib/gallery/antechamber.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'

import Room from '../base/Room.ts'
import chunkBoxes from '../lib/chunkBoxes.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

const {center: [originX, originZ], size} = antechamber

/** Lit through its central starry dome and the twin oculus skylights of its flanking pavilions, with a warm lamp at the head of its east ascending stairs. */
export default class Antechamber extends Room {
  // Central hall up to the dome’s crown, both arched necks, both flanking pavilions up to their skylight crowns, and the east ascending stairs with their top landing.
  override readonly air = [
    floorBox(size, 0, antechamberDomeCrownY),
    ...antechamberNecks.map(({center: [x, z], size: neckSize, height}) => floorBox(neckSize, 0, height, [x - originX, z - originZ])),
    ...antechamberPavilions.map(({center: [x, z], size: pavSize, crownY}) => floorBox(pavSize, 0, crownY, [x - originX, z - originZ])),
    ...chunkBoxes(antechamberEastFlight.chunks(0.1), [originX, 0, originZ]),
    floorBox(antechamberEastLanding.size, antechamberEastLanding.floorY, antechamberEastLanding.height, [antechamberEastLanding.center[0] - originX, antechamberEastLanding.center[1] - originZ]),
  ]
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over its central hall, necks, flanking pavilions and east stairs from the slab up.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = antechamber.height
  override readonly id = 'antechamber'
  override readonly size = size
  // Just north of the middle, looking south into the domed hall.
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
      lamps,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
