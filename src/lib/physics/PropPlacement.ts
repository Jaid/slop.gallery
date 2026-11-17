import type {Vec3} from '../gallery/types.ts'
import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

import {Ray} from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import {isPlayerCollider} from './ReleaseGrace.ts'

/** how far a released prop stays from what its sweep hits, in meters */
const skin = 0.025

/** Where a prop fits in the world, with its own shapes and its current rotation, used both while carrying and when letting go. */
export default class PropPlacement {
  private obstacle = (collider: Collider) => collider.isEnabled() && collider.parent()?.isEnabled() !== false && !collider.isSensor()

  private sweepObstacle = (collider: Collider) => this.obstacle(collider) && !isPlayerCollider(collider)

  constructor(readonly world: World, readonly body: RigidBody) {}

  /** Whether the prop fits at `position`; `includePlayer` false lets it overlap the player’s capsule. */
  hasRoom(position: Vec3, includePlayer = true) {
    const predicate = includePlayer ? this.obstacle : this.sweepObstacle
    return this.shapes(position).every(({center, orientation, shape}) => !this.world.intersectionWithShape(center, orientation, shape, undefined, undefined, undefined, this.body, predicate))
  }

  /**
   * How far toward `target` the prop gets from `origin`, which lies inside the player’s capsule, before any of its parts meets something: the place to let it go, short of walls, pedestals and floors in the way. The player is deliberately excluded; release grace handles that overlap. Null means keep holding, never restore an earlier pose.
   * Every part sweeps, offset covers and labels too: a center ray misses pedestals below the sightline and lets the prop’s edges enter the stone.
   */
  reach(origin: Vec3, target: Vec3): Vec3 | null {
    const clear = this.clearOrigin(origin)
    if (!clear || !this.accessible(origin, clear)) {
      return null
    }
    const start = new Vector3(...clear)
    const direction = new Vector3(...target)
    direction.sub(start)
    let distance = direction.length()
    direction.normalize()
    for (const {center, orientation, shape} of this.shapes(clear)) {
      const hit = this.world.castShape(center, orientation, direction, shape, skin, distance, false, undefined, undefined, undefined, this.body, this.sweepObstacle)
      if (hit) {
        distance = Math.max(0, hit.time_of_impact)
      }
    }
    const position = start.addScaledVector(direction, distance).toArray()
    return this.hasRoom(position, false) ? position : null
  }

  /** A contact normal must not eject an offset part to the far side of a thin wall. Every shape’s center must remain reachable from the grip, even if the body’s origin is on this side already. */
  private accessible(origin: Vec3, position: Vec3) {
    const start = new Vector3(...origin)
    return this.shapes(position).every(({center}) => {
      const direction = center.clone().sub(start)
      const distance = direction.length()
      return distance < 0.0001 || !this.world.castRay(new Ray(start, direction.normalize()), distance, true, undefined, undefined, undefined, this.body, this.sweepObstacle)
    })
  }

  /** Retract a bulky item locally out of a nearby wall or floor before sweeping the arm. Signed contact normals push toward free space, never toward a remote pickup pose. A narrow space that cannot hold the item keeps it in hand. */
  private clearOrigin(origin: Vec3): Vec3 | null {
    const position = new Vector3(...origin)
    for (let pass = 0; pass < 8; pass++) {
      const point = position.toArray()
      if (this.hasRoom(point, false)) {
        return point
      }
      let depth = 0
      const normal = new Vector3
      for (const {center, orientation, shape} of this.shapes(point)) {
        this.world.intersectionsWithShape(center, orientation, shape, obstacle => {
          const contact = obstacle.contactShape(shape, center, orientation, skin)
          if (contact && skin - contact.distance > depth) {
            depth = skin - contact.distance
            normal.set(contact.normal1.x, contact.normal1.y, contact.normal1.z)
          }
          return true
        }, undefined, undefined, undefined, this.body, this.sweepObstacle)
      }
      position.addScaledVector(normal, depth)
      if (!depth || position.distanceTo(new Vector3(...origin)) > 0.75) {
        return null
      }
    }
    return this.hasRoom(position.toArray(), false) ? position.toArray() : null
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
