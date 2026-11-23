import type {FloorRectangle} from '#src/lib/gallery/floors.ts'

import {Geofence} from 'geofency'

import antechamber, {antechamberGallery, antechamberLanding, antechamberStairs, antechamberWings} from '#src/lib/gallery/antechamber.ts'
import {antechamberDomeCrownY} from '#src/lib/gallery/antechamberDomeShape.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'

import Room from '../base/Room.ts'
import chunkBoxes from '../lib/chunkBoxes.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import fences from './fences.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

const origin = roomOrigins.antechamber
/** the part’s floor plan relative to the room’s origin */
const local = ({center: [x, z]}: FloorRectangle) => [x - origin[0], z - origin[2]] as const
/** The flight out of the east wing is cut into chunks whose boxes reach at most this far past its sides. */
const flightSlack = 0.1

/**
 * A domed middle south of the Lobby with a lower wing off either side: the west one leads into a skylit gallery south toward the stairs down to Moonfall, out of the east one a flight climbs toward the floor above.
 * Lit through the windows of its dome and the oculi of its wings, its gallery and its landing, without lamps of its own.
 */
export default class Antechamber extends Room {
  override readonly air = [
    // The middle, up to the crown of the dome.
    floorBox(antechamber.size, 0, antechamberDomeCrownY),
    ...[antechamberWings.west, antechamberWings.east, antechamberGallery].map(part => floorBox(part.size, 0, part.height, local(part))),
    // The flight out of the east wing and the landing at its head, up to their ceilings.
    ...chunkBoxes(antechamberStairs.chunks(flightSlack), origin),
    floorBox(antechamberLanding.size, antechamberLanding.floorY, antechamberLanding.height, local(antechamberLanding)),
  ]
  override readonly description = 'A pause between the peculiar and the profound.'
  // Everything over its floor plans from the slab up, the dome included, and over the flight out of the east wing and its landing.
  override readonly fence = new Geofence([
    ...this.air.slice(0, 4).map(box => ({
      ...footprint([box]),
      floor: groundFenceY,
    })),
    {
      ...footprint(this.air.slice(4)),
      floor: groundFenceY,
    },
  ])
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = antechamber.height
  override readonly id = 'antechamber'
  override readonly size = antechamber.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Antechamber',
      mood: 'antechamber',
      frame: ['kumiko'],
      cameras,
      fences,
      skybox: 'sky',
      slots,
      spawns,
      walls,
      map,
    })
  }
}
