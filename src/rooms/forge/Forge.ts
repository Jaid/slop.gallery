import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import forge, {forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeCupola, forgeRoof} from '#src/lib/gallery/forgeRoof.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {center: [vestibuleX, vestibuleZ], radius} = forgeVestibule

/** A workshop where the gallery’s visitors are invited to make something of their own, starting with the alchemy machine, which gives Transparent Orbs a flavor and shoots every orb thrown into it off toward the Bastion. Sunlight falls through the workshop’s sawtooth roof; a copper pendant lights the vestibule. */
export default class Forge extends Room {
  override readonly air = [
    floorBox(forge.size, 0, forgeRoof.ridgeY),
    // The Bastion arrives in the round vestibule under its segmental brick cap.
    floorBox([radius * 2, radius * 2], 0, forgeCupola.crownY, [vestibuleX - forge.center[0], vestibuleZ - forge.center[1]]),
  ]
  override readonly description = 'Make something of your own.'
  // Everything over its floor plan and its vestibule’s from the slab up, the sawtooth roof and cupola included; the Bastion’s western mouth passes underneath, below the slab, and its curve under the vestibule. It comes before the Bastion, so the vestibule’s wall with the arch onto the approach is the Forge’s.
  override readonly fence = new Geofence(this.air.map(box => ({
    ...footprint([box]),
    floor: groundFenceY,
  })))
  override readonly height = 5.8
  override readonly id = 'forge'
  override readonly size = forge.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Forge',
      mood: 'forge',
      frame: ['impressionist', 'palette', 'twig', 'mission', 'gilding', 'slabs'],
      cameras,
      spawns,
      skybox: 'sky',
      volumetricSun: 1.6,
      lamps,
      walls,
      map,
    })
  }
}
