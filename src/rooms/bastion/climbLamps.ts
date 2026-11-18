import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import {bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {climbElbowLantern, climbHairpin, climbHairpinLantern, climbRun, climbRunLantern} from '#src/lib/gallery/climb.ts'
import {routeLight} from '#src/lib/gallery/pendants/mounts.ts'

const [originX, originY, originZ] = bastionOrigin
/** The light source sits 30 cm below the middle of the lantern. */
const lantern = ([x, y, z]: Vec3): Lamp => ({
  position: [x - originX, y - 0.3 - originY, z - originZ],
  strength: 30,
  tint: '#ffcd8a',
  range: 7,
  decay: 1.75,
  shadow: true,
})

export default {
  lantern_elbow: lantern(climbElbowLantern.light),
  // Halfway up the hairpin’s east leg.
  lantern_climb: lantern(routeLight(climbHairpin, climbHairpinLantern)),
  // Halfway along the run north, over the Lodge’s roof.
  lantern_run: lantern(routeLight(climbRun, climbRunLantern)),
} satisfies Record<string, Lamp>
