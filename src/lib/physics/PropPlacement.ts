import type {Vec3} from '../gallery/types.ts'
import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

import {Quaternion, Vector3} from 'three/webgpu'

/** how far a released prop stays from what its sweep hits, in meters */
const skin = 0.025

/** Where a prop fits in the world, with its own shapes and its current rotation, asked only when a carried prop is let go of. */
export default class PropPlacement {
  private obstacle = (collider: Collider) => collider.isEnabled() && !collider.isSensor()

  private sweepObstacle = (collider: Collider) => {
    const data = collider.parent()?.userData
    const player = data && typeof data === 'object' && 'isPlayer' in data && data.isPlayer === true
    return this.obstacle(collider) && !player
  }

  constructor(readonly world: World, readonly body: RigidBody) {}

  /** Whether the prop fits at `position`; `includePlayer` false lets it overlap the player’s capsule. */
  hasRoom(position: Vec3, includePlayer = true) {
    const predicate = includePlayer ? this.obstacle : this.sweepObstacle
    return this.shapes(position).every(({center, orientation, shape}) => !this.world.intersectionWithShape(center, orientation, shape, undefined, undefined, undefined, this.body, predicate))
  }

  /**
   * How far toward `target` the prop gets from `origin`, which lies inside the player’s capsule, before any of its parts meets something: the place to let it go, short of walls, pedestals and floors in the way. Null where it fits nowhere along the way, excluding the player’s capsule.
   * Every part sweeps, offset covers and labels too: a center ray misses pedestals below the sightline and lets the prop’s edges enter the stone.
   */
  reach(origin: Vec3, target: Vec3): Vec3 | null {
    const start = new Vector3(...origin)
    const direction = new Vector3(...target)
    direction.sub(start)
    let distance = direction.length()
    direction.normalize()
    for (const {center, orientation, shape} of this.shapes(origin)) {
      const hit = this.world.castShape(center, orientation, direction, shape, skin, distance, false, undefined, undefined, undefined, this.body, this.sweepObstacle)
      if (hit) {
        distance = Math.max(0, hit.time_of_impact)
      }
    }
    const position = start.addScaledVector(direction, distance).toArray()
    return this.hasRoom(position, false) ? position : null
  }

  private shapes(position: Vec3) {
    const rotation = this.body.rotation()
    const parentRotation = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    return Array.from({length: this.body.numColliders()}, (_, i) => {
      const collider = this.body.collider(i)
      const offset = collider.translationWrtParent()!
      const colliderRotation = collider.rotationWrtParent()!
      const colliderCenter = new Vector3(offset.x, offset.y, offset.z)
      return {
        shape: collider.shape,
        center: colliderCenter.applyQuaternion(parentRotation).add(new Vector3(...position)),
        orientation: parentRotation.clone().multiply(new Quaternion(colliderRotation.x, colliderRotation.y, colliderRotation.z, colliderRotation.w)),
      }
    })
  }
}
