import type {Portrait, Vec3} from './types.ts'
import type {RapierRigidBody} from '@react-three/rapier'
import type {Group} from 'three/webgpu'

const portraitObjects = new Map<string, {
  body: RapierRigidBody
  group: Group
}>
export default portraitObjects

/** Where a work is right now: where its body is in the world, which a loose work’s own position only catches up with once it comes to rest, or that position while the world doesn’t show the work. */
export function portraitPosition({id, position}: Pick<Portrait, 'id' | 'position'>): Vec3 {
  const physical = portraitObjects.get(id)?.body.translation()
  return physical ? [physical.x, physical.y, physical.z] : position
}
