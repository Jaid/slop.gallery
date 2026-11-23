import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairwayAir} from '#src/lib/gallery/staircase.ts'

const {center: [originX, originZ]} = lowerGallery.moonfall
const originY = lowerGallery.floorY

/** Both flights and the turn, above their slabs and outside the hall’s east wall. */
export default {
  stairs: new Geofence(stairwayAir.map(({min, max}) => ({
    x: min[0] - originX,
    z: min[2] - originZ,
    x2: max[0] - originX,
    z2: max[2] - originZ,
    y: min[1] - originY,
    y2: max[1] + 0.2 - originY,
  }))),
} satisfies Record<string, Geofence>
