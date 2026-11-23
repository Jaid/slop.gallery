import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import staircase, {stairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall: plan} = lowerGallery
/** the stairway’s footprint relative to the middle of the room’s floor plan */
const footprint = {
  x: stairwayFootprint.x - plan.center[0],
  z: stairwayFootprint.z - plan.center[1],
  x2: stairwayFootprint.x2 - plan.center[0],
  z2: stairwayFootprint.z2 - plan.center[1],
}
/** where the upper flight sets out, through the east wall of the Antechamber’s lunar hall */
const startX = staircase.startX - plan.center[0]
/**
 * The stairway between the Antechamber’s lunar hall and Moonfall at every height, relative to the middle of the room’s floor plan: its footprint east of where the upper flight sets out, and west of there, where it reaches to the hall’s east wall, only the lower flight south of the lunar hall.
 * It is all of Moonfall’s fence that lies outside of its hall, and none of it lies under the lunar hall.
 */
export const stairway = [
  {
    ...footprint,
    x: startX,
  },
  {
    ...footprint,
    x2: startX,
    z: staircase.returnZ - staircase.lowerWidth / 2 - plan.center[1],
  },
]

export default {
  /** The stairway between the Antechamber’s lunar hall and Moonfall: from the hall’s east wall down its upper flight, round its turn and down its lower flight to Moonfall’s east wall. */
  stairs: new Geofence(stairway),
} satisfies Record<string, Geofence>
