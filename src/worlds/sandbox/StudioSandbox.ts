import {lazy} from 'react'

import {environmentSeed} from '#src/lib/gameSeed.ts'
import {studioLook} from '#src/rooms/studio/look.ts'
import Studio from '#src/rooms/studio/Studio.ts'

import Sandbox from './base/Sandbox.ts'

const scene = lazy(() => import('#src/rooms/studio/components/StudioRoom/index.tsx'))

/** The Sandbox as `?room=studio` opens it: the Studio instead of the Cell, four bare walls to snap and film things in, which load in a moment, the corner of the north and east ones at the world’s origin. */
export default class StudioSandbox extends Sandbox<Studio> {
  override readonly defaultRoom = 'studio'
  override readonly Scene = scene

  /** @param seed what rolls how the Studio is lit and its works are framed, this game’s by default */
  constructor(seed = environmentSeed) {
    const studio = new Studio(studioLook(seed))
    // The corner lies on the floor, which stays at the world’s height.
    const [x, , z] = studio.corner
    super(studio, [-x, 0, -z])
  }
}
