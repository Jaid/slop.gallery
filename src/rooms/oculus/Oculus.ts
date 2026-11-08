import {Geofence} from 'geofency'

import reverberation from '#src/lib/audio/transformers/reverberation.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery, {oculusPlatform} from '#src/lib/gallery/lowerGallery.ts'
import oculusApse from '#src/lib/gallery/oculusApse.ts'
import RoomMood from '#src/lib/moods/RoomMood.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

const {oculus} = lowerGallery
// Up to the ceiling’s underside, not the upper room’s walkable surface.
const height = oculus.ceiling.topY - oculus.ceiling.thickness - oculus.floorY
const platformHeight = oculusPlatform.position[1] + oculusPlatform.size[1] / 2 - oculus.floorY

/** Laid out around the middle of its floor plan without the apse, at the height of its floor. */
export default class Oculus extends Room {
  override readonly air = [
    floorBox(oculus.size, 0, height),
    // The box around the apse, over the platform that fills it.
    floorBox([oculus.size[0], oculusApse.depth], platformHeight, height - platformHeight, [0, -(oculus.size[1] + oculusApse.depth) / 2]),
  ]
  override readonly description = 'Borrowed light from the gallery above.'
  // Everything under its floor plan and the apse, up into the slab of the Lobby above; it comes before the Exhibition, so the middle of the balcony is the Oculus’, and after the Bastion, which curves round the apse through the corners of its box.
  override readonly fence = new Geofence([{
    ...footprint(this.air),
    ceiling: groundFenceY - oculus.floorY,
  }])
  override readonly height = height
  override readonly id = 'oculus'
  override readonly size = oculus.size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'Oculus',
      moods: [
        new RoomMood({
          id: 'oculus',
          title: 'Round tower',
          // A round tower, whose curved wall throws a ring back.
          transformer: reverberation({
            decay: 2.8,
            predelay: 0.028,
            brightness: [7000, 1800],
            early: [[0.09, 0.45], [0.18, 0.22], [0.27, 0.1]],
            wet: 0.22,
          }),
        }),
      ],
      frame: ['oculus-float', 'oculus-acrylic', 'oculus-dichroic'],
      portraitArea: 60_000,
      cameras,
      spawns,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
