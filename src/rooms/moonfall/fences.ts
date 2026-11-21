import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall: plan} = lowerGallery
/** the stairway’s footprint relative to the middle of the room’s floor plan */
const stairway = {
  x: stairwayFootprint.x - plan.center[0],
  z: stairwayFootprint.z - plan.center[1],
  x2: stairwayFootprint.x2 - plan.center[0],
  z2: stairwayFootprint.z2 - plan.center[1],
}
/** where the hall’s east wall stands, which the stairway arrives in */
const eastX = plan.size[0] / 2

export default {
  /**
   * The stairway between the Antechamber and Moonfall: from the Antechamber’s east wall down its upper flight, round its turn and down its lower flight to the hall’s east wall.
   * Whatever of Moonfall’s fence lies outside of its hall: the stairway’s footprint at every height east of the hall’s east wall, and over the hall’s ceiling west of it, where the upper flight sets out.
   */
  stairs: new Geofence([
    {
      ...stairway,
      x2: eastX,
      floor: 6,
    },
    {
      ...stairway,
      x: eastX,
    },
  ]),
} satisfies Record<string, Geofence>
