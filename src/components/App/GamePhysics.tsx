import type {GameWrapperProps} from 'three-fiber-game'

import {Physics} from '@react-three/rapier'

import {usePhysicsHold} from '#src/lib/gallery/roomLoading.ts'

/**
 * Rapier for the scene, paused while rooms that bring their own floors are still loading, so that nothing falls through them.
 * It reads the hold inside the Canvas: Game’s props only reach the scene once Fiber commits the Canvas, which can be a second after the scene’s first physics steps, long enough for a player spawning in such a room to fall through its floor.
 */
export default function GamePhysics({children, paused = false}: GameWrapperProps & {paused?: boolean}) {
  const held = usePhysicsHold(state => state.held)
  return <Physics paused={held || paused}>{children}</Physics>
}
