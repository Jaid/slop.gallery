import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {approachFootprints, stairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall: plan} = lowerGallery
const groundFloor = groundFenceY - lowerGallery.floorY

export default {
  /**
   * The curved level approach and descending stairway between the Antechamber’s west pavilion and Moonfall’s east wall:
   * whatever of Moonfall’s fence lies outside of its hall — the curved approach over the hall’s ceiling, and the descending flights and U-turn east of the hall’s east wall.
   */
  stairs: new Geofence([
    ...approachFootprints.map(({x, z, x2, z2}) => ({
      x: x - plan.center[0],
      z: z - plan.center[1],
      x2: x2 - plan.center[0],
      z2: z2 - plan.center[1],
      floor: groundFloor,
    })),
    {
      x: stairwayFootprint.x - plan.center[0],
      z: stairwayFootprint.z - plan.center[1],
      x2: stairwayFootprint.x2 - plan.center[0],
      z2: stairwayFootprint.z2 - plan.center[1],
    },
  ]),
} satisfies Record<string, Geofence>
