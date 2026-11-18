import type {Lamp} from '../base/Room.ts'

import {bastionCurve, bastionGateLantern, bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {cisternLantern} from '#src/lib/gallery/cistern/cistern.ts'
import {routeLight} from '#src/lib/gallery/pendants/mounts.ts'

import climbLamps, {lantern} from './climbLamps.ts'

const [originX, originY, originZ] = bastionOrigin
const [gateX, gateY, gateZ] = routeLight(bastionCurve, bastionGateLantern)

export default {
  ...climbLamps,
  // Under the cistern’s half dome, lighting the channel and shining out through the window into the Forge’s vestibule.
  lantern_cistern: lantern(cisternLantern.light, {range: 9}),
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
