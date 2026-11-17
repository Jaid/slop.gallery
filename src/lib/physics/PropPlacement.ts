import type {Vec3} from '../gallery/types.ts'
import type {Collider, RigidBody, Shape, World} from '@dimforge/rapier3d-compat'

import {Ray} from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import {isPlayerCollider} from './PlayerGrace.ts'

/** how far a released prop stays from what its sweep hits or it is pushed out of, in meters */
const skin = 0.025
/** how deep a prop may still be in something once pushed out of it, in meters, which the solver resolves on its own without a jolt */
const tolerance = 0.002
/** how often pushing a prop out of what it is in tries again, each time out of the deepest part */
const pushes = 12
/** where along the line from where letting go starts to where the sweep stopped a prop is let go of when it doesn’t fit there, from that end back to the start */
const fallbacks = [0.75, 0.5, 0.25, 0]

type PartPose = {
  center: Vector3
  orientation: Quaternion
  shape: Shape
}
/** how deep a prop is in something at a place, in meters */
type Fit = {
  depth: number
  position: Vec3
}

/** Where a prop fits in the world, with its own shapes and its current rotation, asked while a prop is carried, which shows it where it fits, and when it is let go of. */
export default class PropPlacement {
  private obstacle = (collider: Collider) => collider.isEnabled() && !collider.isSensor()

  private sweepObstacle = (collider: Collider) => this.obstacle(collider) && !isPlayerCollider(collider)

  constructor(readonly world: World, readonly body: RigidBody) {}

  /** How deep, in meters, the prop is in anything at `position` but the player’s capsule, by its deepest part; 0 where it fits. */
  depth(position: Vec3) {
    let deepest = 0
    for (const part of this.shapes(position)) {
      deepest = Math.max(deepest, this.deepestContact(part)?.depth ?? 0)
    }
    return deepest
  }

  /**
   * Pushes the prop out of whatever it is in at `position`, but the player’s capsule, as a hand would squeeze it out of a corner: out of its deepest overlap at a time, a little clear of it.
   * Returns where that got it and how deep it still is there, which is 0 where it came free.
   */
  free(position: Vec3): Fit {
    const at = new Vector3(...position)
    for (let push = 0; push < pushes; push++) {
      let deepest: ReturnType<PropPlacement['deepestContact']>
      for (const part of this.shapes(at.toArray())) {
        const contact = this.deepestContact(part)
        if (contact && (!deepest || contact.depth > deepest.depth)) {
          deepest = contact
        }
      }
      if (!deepest || deepest.depth <= tolerance) {
        return {
          position: at.toArray(),
          depth: deepest?.depth ?? 0,
        }
      }
      at.addScaledVector(deepest.normal, deepest.depth + skin)
    }
    return {
      position: at.toArray(),
      depth: this.depth(at.toArray()),
    }
  }

  /** Whether the prop fits at `position`; `includePlayer` false lets it overlap the player’s capsule. */
  hasRoom(position: Vec3, includePlayer = true) {
    const predicate = includePlayer ? this.obstacle : this.sweepObstacle
    return this.shapes(position).every(({center, orientation, shape}) => !this.world.intersectionWithShape(center, orientation, shape, undefined, undefined, undefined, this.body, predicate))
  }

  /**
   * Where to let go of the prop, carried from `origin`, inside the player’s capsule, toward `target`, where it was held: as far along that line as it gets before any of its parts meets something but the player (see {@link sweep}), which it may still overlap, as the prop passes through the player for a moment after letting go (see `PlayerGrace`).
   * Where it doesn’t fit there, as a large prop next to a wall reaches into it from the start, it is pushed out of what it is in, there or else further back along the line, but never to where something stands between it and `origin`. Where it fits nowhere, it is let go of wherever it is in the least, and the physics pushes it out of the rest. It always comes loose somewhere near the hand, never back where it was picked up.
   */
  letGo(origin: Vec3, target: Vec3): Vec3 {
    const swept = this.sweep(origin, target)
    const start = new Vector3(...origin)
    const end = new Vector3(...swept)
    let best: Fit | undefined
    for (const share of [1, ...fallbacks]) {
      const candidate = start.clone().lerp(end, share).toArray()
      if (this.hasRoom(candidate, false)) {
        return candidate
      }
      const fit = this.free(candidate)
      if (!this.inSight(origin, fit.position)) {
        continue
      }
      if (fit.depth <= tolerance) {
        return fit.position
      }
      if (!best || fit.depth < best.depth) {
        best = fit
      }
    }
    if (best) {
      return best.position
    }
    // Nothing pushed out stays on this side of what it is in: the place it is least deep in along the way.
    return [1, ...fallbacks].map(share => start.clone().lerp(end, share).toArray()).reduce((least, candidate) => (this.depth(candidate) < this.depth(least) ? candidate : least))
  }

  /**
   * How far toward `target` the prop gets from `origin`, which lies inside the player’s capsule, before any of its parts meets something: short of walls, pedestals and floors in the way, never of the player.
   * Every part sweeps, offset covers and labels too: a center ray misses pedestals below the sightline and lets the prop’s edges enter the stone.
   */
  sweep(origin: Vec3, target: Vec3): Vec3 {
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
    return start.addScaledVector(direction, distance).toArray()
  }

  /** The deepest overlap of `part` with anything but the player’s capsule: how deep, in meters, and the way out of it. */
  private deepestContact({center, orientation, shape}: PartPose) {
    let deepest: {
      depth: number
      normal: Vector3
    } | undefined
    this.world.intersectionsWithShape(center, orientation, shape, collider => {
      const contact = collider.contactShape(shape, center, orientation, 0)
      if (contact && contact.distance < 0 && (!deepest || -contact.distance > deepest.depth)) {
        // The normal points out of the collider, the way out for the prop.
        deepest = {
          depth: -contact.distance,
          normal: new Vector3(contact.normal1.x, contact.normal1.y, contact.normal1.z),
        }
      }
      return true
    }, undefined, undefined, undefined, this.body, this.sweepObstacle)
    return deepest
  }

  /** Whether nothing but the player stands between `origin` and the middle of the prop at `position`, so pushing it out of something never got it through to the other side. */
  private inSight(origin: Vec3, position: Vec3) {
    const way = new Vector3(...position)
    way.sub(new Vector3(...origin))
    const distance = way.length()
    if (distance < 1e-6) {
      return true
    }
    way.divideScalar(distance)
    const ray = new Ray({
      x: origin[0],
      y: origin[1],
      z: origin[2],
    }, way)
    return !this.world.castRay(ray, distance, true, undefined, undefined, undefined, this.body, this.sweepObstacle)
  }

  private shapes(position: Vec3): Array<PartPose> {
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
