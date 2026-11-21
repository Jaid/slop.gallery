import {Geofence} from 'geofency'

import corridor from '#src/lib/gallery/corridor.ts'
import {lodgeWindow} from '#src/lib/gallery/lodge.ts'

/** how far past either side of the Lodge’s west window the long hall still looks through it */
const windowReach = 1

export default {
  /** The long hall abreast of the Lodge’s west window, which looks into the Lodge over the deep sill of its niche: from the hall’s west wall to the window’s glass, from a meter north of the window to a meter south of it, from a meter under the floor to half a meter over the hall’s crown, so it lies within the Corridor’s fence. */
  window: new Geofence([{
    x: -corridor.size[0] / 2,
    z: lodgeWindow.z - lodgeWindow.width / 2 - windowReach - corridor.center[1],
    x2: lodgeWindow.tunnelX - corridor.center[0],
    z2: lodgeWindow.z + lodgeWindow.width / 2 + windowReach - corridor.center[1],
    y: -1,
    y2: corridor.height + 0.5,
  }]),
} satisfies Record<string, Geofence>
