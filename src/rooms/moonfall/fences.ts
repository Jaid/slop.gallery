import {Geofence} from 'geofency'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {stairAir} from '#src/lib/gallery/staircase.ts'

const [x, z] = lowerGallery.moonfall.center
export const stairFootprints = stairAir.map(({min, max}) => ({
  x: min[0] - x,
  x2: max[0] - x,
  z: min[2] - z,
  z2: max[2] - z,
}))

export default {stairs: new Geofence(stairFootprints)} satisfies Record<string, Geofence>
