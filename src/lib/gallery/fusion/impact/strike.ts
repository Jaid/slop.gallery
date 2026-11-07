import type {FusionImpact} from '../Fusion.ts'
import type {RapierRigidBody} from '@react-three/rapier'

import {impactSounds} from '../../../audio/impactSounds.ts'

/** How the thrown `body` struck a hung portrait as their collision began: where its middle, its center of mass, was, and the fastest it moved within the last few steps, as the solver may have bounced it already, unless it is no body whose strikes sound, which leaves how fast it moves now. */
export function impactOf(body: RapierRigidBody): FusionImpact {
  const center = body.worldCom()
  const {x, y, z} = body.linvel()
  return {
    center: [center.x, center.y, center.z],
    speed: impactSounds.recentSpeed(body) ?? Math.hypot(x, y, z),
  }
}
