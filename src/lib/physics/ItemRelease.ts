import type {Vec3} from '../gallery/types.ts'
import type {RigidBody, World} from '@dimforge/rapier3d-compat'

import {RigidBodyType} from '@dimforge/rapier3d-compat'

import {itemMass, itemMotion} from './itemMotion.ts'
import PlayerReleaseGrace from './PlayerReleaseGrace.ts'
import PropPlacement from './PropPlacement.ts'

/** Shared release transaction for props and portraits: validate all shapes, install player grace, then enable a dynamic body with fresh momentum. */
export default class ItemRelease {
  readonly grace: PlayerReleaseGrace
  /** Until the first physics step, the renderer’s interpolation history may still point to the pickup spot. */
  interpolationPending = false
  readonly placement: PropPlacement

  constructor(readonly body: RigidBody, world: World) {
    this.placement = new PropPlacement(world, body)
    this.grace = new PlayerReleaseGrace(body, world)
  }

  begin() {
    this.grace.begin()
    this.interpolationPending = true
  }

  release(origin: Vec3, target: Vec3, throwing: boolean, direction: Vec3, playerVelocity: Vec3 = [0, 0, 0]) {
    const position = this.placement.reach(origin, target)
    if (!position) {
      return null
    }
    const motion = itemMotion(itemMass(this.body), direction, throwing, playerVelocity)
    this.begin()
    this.body.setTranslation({
      x: position[0],
      y: position[1],
      z: position[2],
    }, false)
    this.body.setBodyType(RigidBodyType.Dynamic, false)
    this.body.setEnabled(true)
    for (let i = 0; i < this.body.numColliders(); i++) {
      this.body.collider(i).setEnabled(true)
    }
    this.body.resetForces(false)
    this.body.resetTorques(false)
    this.body.wakeUp()
    this.body.setLinvel({
      x: motion.velocity[0],
      y: motion.velocity[1],
      z: motion.velocity[2],
    }, true)
    this.body.setAngvel({
      x: motion.spin[0],
      y: motion.spin[1],
      z: motion.spin[2],
    }, true)
    return motion
  }

  step(seconds: number) {
    this.interpolationPending = false
    this.grace.step(seconds)
  }
}
