import type {Vec3} from '../gallery/types.ts'
import type {Toss} from './throwMotion.ts'
import type {RigidBody, Vector, World} from '@dimforge/rapier3d-compat'

import {RigidBodyType} from '@dimforge/rapier3d-compat'
import {vec3} from 'math'

import currentWorld from '#src/worlds/current.ts'

import PlayerGrace from './PlayerGrace.ts'
import PropPlacement from './PropPlacement.ts'
import {headingOf, spinFor, throwSpeed, toss} from './throwMotion.ts'
import {beginBodyThrow, clearBodyThrow} from './ThrowState.ts'

export type GrabbableBodyOptions = {
  canGrab?: () => boolean
  recoverAsDynamic?: () => boolean
  /** whether it rolls like a ball when thrown, like an orb, instead of tumbling, see `spinFor` */
  rolls?: boolean
}
/** how a carried prop is let go of */
export type ReleaseOptions = {
  /** how fast the one letting go moves, in m/s, which the prop carries on with, like the player running or jumping */
  carrier?: Vec3
  /** where a throw is aimed, the line from `origin` to `target` by default */
  direction?: Vec3
  /** whether it is thrown, rather than just let go of */
  throwing?: boolean
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

const still = {
  x: 0,
  y: 0,
  z: 0,
}
const vector = ([x, y, z]: Vec3): Vector => ({
  x,
  y,
  z,
})

/**
 * The physics side of carrying a prop: while carried, its body is out of the simulation altogether, so nothing collides with it, not even the player, and whoever carries it shows it by its own object. Letting go puts it where it fits near the hand, passing through the player for a moment (see `PlayerGrace`).
 */
export default class GrabbableBody {
  readonly grace: PlayerGrace
  readonly placement: PropPlacement
  private carrying = false
  private home: BodyPose | null = null

  constructor(readonly body: RigidBody, world: World, private readonly options: GrabbableBodyOptions = {}) {
    this.placement = new PropPlacement(world, body)
    this.grace = PlayerGrace.of(body)
  }

  get active() {
    return this.carrying
  }

  /** the prop’s mass in kg, by its colliders, also while they are disabled, which the body’s own mass leaves out */
  get mass() {
    return this.colliders().reduce((sum, collider) => sum + collider.mass(), 0)
  }

  /** Leaves the prop where it was before it was grabbed, which is where its body never stopped being. */
  cancel() {
    if (!this.carrying) {
      return
    }
    this.carrying = false
    this.body.setEnabled(true)
    this.body.wakeUp()
  }

  /**
   * Throws the prop from `position` with `velocity`, in meters per second, turning like the player’s throws, wherever it lies, loose from then on, as if the player had let go of it there: tumbling as an orb’s throw would, or, if it rolls, rolling forward by its speed. Does nothing while it is carried.
   * Returns whether it did.
   */
  fling(position: Vec3, velocity: Vec3) {
    if (this.carrying) {
      return false
    }
    this.rememberHome()
    const {rolls} = this.options
    const spin = spinFor({
      heading: headingOf(velocity),
      rolls,
      strength: rolls ? vec3.length(velocity) / throwSpeed : 1,
    })
    this.loose(position, vector(velocity), vector(spin))
    this.grace.begin()
    beginBodyThrow(this.body)
    return true
  }

  grab() {
    if (this.carrying || this.options.canGrab?.() === false) {
      return false
    }
    this.rememberHome()
    clearBodyThrow(this.body)
    this.grace.end()
    this.carrying = true
    this.stop()
    this.body.setEnabled(false)
    return true
  }

  recover() {
    this.rememberHome()
    const position = this.body.translation()
    if (!this.carrying && this.home && position.y < currentWorld.placement.floorHeight([position.x, position.y, position.z]) - 4) {
      // A Knot knocked out of its showcase comes back loose instead of floating in it again.
      const home = this.options.recoverAsDynamic?.() ? {
        ...this.home,
        type: RigidBodyType.Dynamic,
        collisions: this.home.collisions.map(() => true),
      } : this.home
      this.restore(home)
    }
  }

  /**
   * Lets go of the prop near `target`, where it was held, coming from `origin`, inside the player’s capsule: as far toward it as it fits, pushed out of what it would reach into (see `PropPlacement.letGo`), always near the hand. Loose from then on, it passes through the player for a moment and carries on with the `carrier`’s velocity, and, if `throwing`, flies off along `direction`, by its mass, as `toss` says.
   * Returns how it left the hand, or undefined while it isn’t carried.
   */
  release(origin: Vec3, target: Vec3, {carrier, direction, throwing = false}: ReleaseOptions = {}): Toss | undefined {
    if (!this.carrying) {
      return
    }
    const position = this.placement.letGo(origin, target)
    this.carrying = false
    const thrown = toss({
      carrier,
      direction: direction ?? target.map((value, axis) => value - origin[axis]) as Vec3,
      mass: this.mass,
      rolls: this.options.rolls,
      throwing,
    })
    this.loose(position, vector(thrown.velocity), vector(thrown.spin))
    this.grace.begin()
    if (throwing) {
      beginBodyThrow(this.body)
    }
    return thrown
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
    this.body.setTranslation(vector(position), false)
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
    clearBodyThrow(this.body)
    this.grace.end()
    this.body.setBodyType(pose.type, true)
    this.body.setTranslation(vector(pose.position), false)
    this.body.setRotation(pose.rotation, true)
    for (const [i, collider] of this.colliders().entries()) {
      collider.setEnabled(pose.collisions[i] ?? false)
    }
    this.stop()
    this.body.wakeUp()
  }

  private stop() {
    this.body.setLinvel(still, true)
    this.body.setAngvel(still, true)
  }
}
