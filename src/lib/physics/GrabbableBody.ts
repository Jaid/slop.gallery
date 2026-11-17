import type {Vec3} from '../gallery/types.ts'
import type {RigidBody, Vector, World} from '@dimforge/rapier3d-compat'

import {RigidBodyType} from '@dimforge/rapier3d-compat'

import currentWorld from '#src/worlds/current.ts'

import ItemRelease from './ItemRelease.ts'
import {beginBodyThrow, clearBodyThrow} from './ThrowState.ts'

export type GrabbableBodyOptions = {
  canGrab?: () => boolean
  onAttachmentChange?: (attached: boolean) => void
  recoverAsDynamic?: () => boolean
}

type BodyPose = {
  collisions: Array<boolean>
  position: Vec3
  rotation: {
    w: number
    x: number
    y: number
    z: number
  }
  type: ReturnType<RigidBody['bodyType']>
}

/** how a thrown prop tumbles, in radians per second */
const throwSpin = {
  x: 3,
  y: 2,
  z: 1,
}
const still = {
  x: 0,
  y: 0,
  z: 0,
}

/**
 * The physics side of carrying a prop: while carried, its body is out of the simulation altogether, so nothing collides with it, not even the player, and whoever carries it shows it by its own object. Its placement also constrains the carried visual; letting go validates it again.
 * Shared by sculptures, orbs and detachable foliage. A canceled pluck leaves a leaf attached where it was; a canceled re-grab leaves a loose leaf where it lay.
 */
export default class GrabbableBody {
  readonly releaseBody: ItemRelease

  private carrying = false
  private home: BodyPose | null = null
  constructor(readonly body: RigidBody, world: World, private readonly options: GrabbableBodyOptions = {}) {
    this.releaseBody = new ItemRelease(body, world)
  }

  get active() {
    return this.carrying
  }

  get placement() {
    return this.releaseBody.placement
  }

  /** Leaves the prop where it was before it was grabbed, which is where its body never stopped being. */
  cancel() {
    if (!this.carrying) {
      return
    }
    this.carrying = false
    this.body.setEnabled(true)
    this.body.wakeUp()
    this.options.onAttachmentChange?.(this.body.isFixed())
  }

  /**
   * Throws the prop from `position` with `velocity`, in meters per second, tumbling like the player’s throws, wherever it lies, loose from then on, as if the player had let go of it there. Does nothing while it is carried.
   * Returns whether it did.
   */
  fling(position: Vec3, velocity: Vec3) {
    if (this.carrying) {
      return false
    }
    this.rememberHome()
    this.releaseBody.begin()
    this.loose(position, {
      x: velocity[0],
      y: velocity[1],
      z: velocity[2],
    }, throwSpin)
    beginBodyThrow(this.body)
    return true
  }

  grab() {
    if (this.carrying || this.options.canGrab?.() === false) {
      return false
    }
    this.rememberHome()
    this.releaseBody.grace.clear()
    clearBodyThrow(this.body)
    this.carrying = true
    this.stop()
    this.body.setEnabled(false)
    this.options.onAttachmentChange?.(false)
    return true
  }

  recover() {
    this.rememberHome()
    const position = this.body.translation()
    if (!this.carrying && this.home && position.y < currentWorld.placement.floorHeight([position.x, position.y, position.z]) - 4) {
      // A leaf cannot reattach to an anchor that has itself been picked up or thrown.
      const home = this.options.recoverAsDynamic?.() ? {
        ...this.home,
        type: RigidBodyType.Dynamic,
        collisions: this.home.collisions.map(() => true),
      } : this.home
      this.restore(home)
    }
  }

  /** Release where the full shape fits, ignoring only the player. If scenery leaves no room, keep holding it instead of returning it to the pickup spot. */
  release(origin: Vec3, target: Vec3, throwing: boolean, direction?: Vec3, playerVelocity?: Vec3) {
    if (!this.carrying) {
      return null
    }
    const motion = this.releaseBody.release(origin, target, throwing, direction ?? target.map((value, axis) => value - origin[axis]) as Vec3, playerVelocity)
    if (!motion) {
      return null
    }
    this.carrying = false
    if (throwing) {
      beginBodyThrow(this.body)
    }
    return motion
  }

  rememberHome() {
    // Auto-generated colliders are installed after the rigid body’s mount effect.
    if (!this.home && this.body.numColliders()) {
      this.home = this.capture()
    }
  }

  private capture(): BodyPose {
    const p = this.body.translation()
    return {
      position: [p.x, p.y, p.z],
      rotation: this.body.rotation(),
      type: this.body.bodyType(),
      collisions: this.colliders().map(collider => collider.isEnabled()),
    }
  }

  private colliders() {
    return Array.from({length: this.body.numColliders()}, (_, i) => this.body.collider(i))
  }

  /** Puts the body at `position`, dynamic and colliding, moving and turning as given. */
  private loose(position: Vec3, velocity: Vector, spin: Vector) {
    this.body.setTranslation({
      x: position[0],
      y: position[1],
      z: position[2],
    }, false)
    this.body.setBodyType(RigidBodyType.Dynamic, false)
    // Rapier hands the colliders their own state again at its next step.
    this.body.setEnabled(true)
    for (const collider of this.colliders()) {
      collider.setEnabled(true)
    }
    this.body.wakeUp()
    this.body.setLinvel(velocity, true)
    this.body.setAngvel(spin, true)
  }

  private restore(pose: BodyPose) {
    this.releaseBody.grace.clear()
    clearBodyThrow(this.body)
    this.body.setBodyType(pose.type, true)
    this.body.setTranslation({
      x: pose.position[0],
      y: pose.position[1],
      z: pose.position[2],
    }, false)
    this.body.setRotation(pose.rotation, true)
    for (const [i, collider] of this.colliders().entries()) {
      collider.setEnabled(pose.collisions[i] ?? false)
    }
    this.stop()
    this.body.wakeUp()
    this.options.onAttachmentChange?.(pose.type === RigidBodyType.Fixed)
  }

  private stop() {
    this.body.setLinvel(still, true)
    this.body.setAngvel(still, true)
  }
}
