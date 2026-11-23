import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall: plan} = lowerGallery

export default {
  /**
   * The stairway between the Antechamber’s gallery and Moonfall: from the gallery’s south wall down its upper flight, round its turn and up its lower flight to the hall’s south wall, at every height.
   * It is all of Moonfall’s fence that lies outside of its hall, which ends where the stairway begins.
   */
  stairs: new Geofence([{
    x: stairwayFootprint.x - plan.center[0],
    z: stairwayFootprint.z - plan.center[1],
    x2: stairwayFootprint.x2 - plan.center[0],
    z2: stairwayFootprint.z2 - plan.center[1],
  }]),
} satisfies Record<string, Geofence>
