import {Geofence} from 'geofency'

import corridor, {corridorBayPaving} from '#src/lib/gallery/corridor.ts'
import {floorChunks} from '#src/lib/gallery/floorPolygons.ts'
import {lodgeBay, lodgeWindow} from '#src/lib/gallery/lodge.ts'

import chunkBoxes from '../lib/chunkBoxes.ts'
import footprint from '../lib/footprint.ts'

/** how far past either side of the Lodge’s west window the long hall still looks through it */
const windowReach = 1
/** how far the boxes round the boards’ askew edges may reach past them, as far as the Corridor’s own air */
const slack = 0.35
/** from a meter under the floor to half a meter over the hall’s crown */
const below = -1
const above = corridor.height + 0.5
/** the boards round the Lodge’s bay, from a meter under them to half a meter over the crown */
const bayBoards = new Geofence(chunkBoxes(floorChunks(corridorBayPaving, corridor.floorY, corridor.height, slack), [corridor.center[0], corridor.floorY, corridor.center[1]]).map(box => ({
  ...footprint([box]),
  y: below,
  y2: above,
})))
const {center: [bayX, bayZ], size: [bayWidth, bayDepth]} = lodgeBay.bounds
/** the box round the Lodge’s bay, which the Lodge’s fence takes in, its corners beyond the bay’s slanted walls too */
const bayBox = new Geofence([{
  x: bayX - bayWidth / 2 - corridor.center[0],
  z: bayZ - bayDepth / 2 - corridor.center[1],
  x2: bayX + bayWidth / 2 - corridor.center[0],
  z2: bayZ + bayDepth / 2 - corridor.center[1],
}])

export default {
  /** The long hall abreast of the Lodge’s west window, which looks into the Lodge over the deep sill of its niche: from the hall’s west wall to the window’s glass, from a meter north of the window to a meter south of it, from a meter under the floor to half a meter over the hall’s crown, so it lies within the Corridor’s fence. */
  window: new Geofence([{
    x: -corridor.size[0] / 2,
    z: lodgeWindow.z - lodgeWindow.width / 2 - windowReach - corridor.center[1],
    x2: lodgeWindow.tunnelX - corridor.center[0],
    z2: lodgeWindow.z + lodgeWindow.width / 2 + windowReach - corridor.center[1],
    y: below,
    y2: above,
  }]),
  /** Wherever the Lodge’s planks show: round the Lodge’s bay, from its threshold north through the doorway passage, west along the bay’s back wall and down the diagonal to the long hall, all of which look back through the doorway into the bay, from a meter under the floor to half a meter over the crown. It ends on the threshold’s edge and on the box round the bay, whose corners reach over the diagonal and count as the Lodge, so it lies within the Corridor’s fence and none of the Lodge’s. */
  seeing_lodge_floor: bayBoards.subtract(bayBox)!,
} satisfies Record<string, Geofence>
