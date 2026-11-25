import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import hsl from 'okhsl'

import {bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {climbApproachLantern, climbElbowLantern} from '#src/lib/gallery/climb.ts'

const [originX, originY, originZ] = bastionOrigin
/** The light source sits 30 cm below the middle of the lantern. */
const lantern = ([x, y, z]: Vec3): Lamp => ({
  position: [x - originX, y - 0.3 - originY, z - originZ],
  strength: 30,
  tint: hsl.integer(74, 100, 85.7),
  range: 7,
  decay: 1.75,
  shadow: true,
})

export default {
  lantern_elbow: lantern(climbElbowLantern.light),
  lantern_run: lantern(climbApproachLantern.light),
} satisfies Record<string, Lamp>
