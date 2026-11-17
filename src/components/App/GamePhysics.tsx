import type {GameWrapperProps} from 'three-fiber-game'

import {Physics, useBeforePhysicsStep} from '@react-three/rapier'

import {usePhysicsHold} from '#src/lib/gallery/roomLoading.ts'
import ReleaseGrace from '#src/lib/physics/ReleaseGrace.ts'

/**
 * Rapier for the scene, paused while rooms that bring their own floors are still loading, so that nothing falls through them.
 * It reads the hold inside the Canvas: Game’s props only reach the scene once Fiber commits the Canvas, which can be a second after the scene’s first physics steps, long enough for a player spawning in such a room to fall through its floor.
 */
export default function GamePhysics({children}: GameWrapperProps) {
  const held = usePhysicsHold(state => state.held)
  return <Physics paused={held}><ReleaseContacts />{children}</Physics>
}

/** Registered before the player’s motor, so its queries see the same groups as the solver. */
function ReleaseContacts() {
  useBeforePhysicsStep(world => ReleaseGrace.for(world).step(world))
  return null
}
