import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {moonfallStairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall: plan} = lowerGallery
/** the stairway’s footprint relative to the middle of the room’s floor plan */
const stairway = {
  x: moonfallStairwayFootprint.x - plan.center[0],
  z: moonfallStairwayFootprint.z - plan.center[1],
  x2: moonfallStairwayFootprint.x2 - plan.center[0],
  z2: moonfallStairwayFootprint.z2 - plan.center[1],
}

export default {
  /**
   * The stairway from the Antechamber’s landing down into Moonfall, where it is above the hall’s ceiling.
   * Below the ceiling the stairwell is the hall itself.
   */
  stairs: new Geofence([{
    ...stairway,
    floor: 7.75,
  }]),
} satisfies Record<string, Geofence>
