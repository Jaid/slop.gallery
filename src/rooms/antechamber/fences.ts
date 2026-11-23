import type {FloorRectangle} from '#src/lib/gallery/floors.ts'

import {Geofence} from 'geofency'

import {antechamberGallery, antechamberWings} from '#src/lib/gallery/antechamber.ts'
import {groundFenceY} from '#src/lib/gallery/floors.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'

const [originX, , originZ] = roomOrigins.antechamber
/** everything over the part’s floor plan from the slab up, relative to the room’s origin */
const over = ({center: [x, z], size: [width, depth]}: FloorRectangle) => ({
  x: x - width / 2 - originX,
  z: z - depth / 2 - originZ,
  x2: x + width / 2 - originX,
  z2: z + depth / 2 - originZ,
  floor: groundFenceY,
})

export default {
  /** the west wing and the gallery off it, the only parts of the room from where the stairs down to Moonfall show: neither the domed middle nor the east wing looks far enough down the gallery */
  west: new Geofence([over(antechamberWings.west), over(antechamberGallery)]),
} satisfies Record<string, Geofence>
