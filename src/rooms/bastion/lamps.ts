import type {Lamp} from '../base/Room.ts'

import {bastionCurve, bastionGateLantern, bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {routeLight} from '#src/lib/gallery/pendants/mounts.ts'

import climbLamps from './climbLamps.ts'

const [originX, originY, originZ] = bastionOrigin
const [gateX, gateY, gateZ] = routeLight(bastionCurve, bastionGateLantern)

export default {
  ...climbLamps,
  // Behind the apse’s gate, low enough to cast the bars’ shadows across the Oculus platform through the gate and the windows beside it.
  lantern_north: {
    position: [gateX - originX, gateY - 0.6 - originY, gateZ - originZ],
    strength: 35,
    tint: '#ffcd8a',
    range: 20,
    decay: 1.25,
    shadow: true,
  },
} satisfies Record<string, Lamp>
