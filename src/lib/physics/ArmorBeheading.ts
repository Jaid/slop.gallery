import type {Vec3} from '../gallery/types.ts'
import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

import {Ball} from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import {suitOfArmor} from '../gallery/suitOfArmor.ts'

/** what a knock did: nothing, or threw off the helmet with that velocity */
export type Knock = {
  /** which way along the floor the suit fell */
  direction: Vec3
  velocity: Vec3
} | undefined

/** how far the helmet’s origin may lie from the top of the suit’s collar and still count as on its shoulders: still resting there, or just sliding off them as the suit tips over fast, about to wedge between it and what it strikes */
const shoulderReach = 0.6
/** how wide a ball feels out how much room the helmet has to fly off, about as wide as the helmet, so it never slips past bars the helmet would not fit through */
const helmetRadius = 0.15
const unturned = {
  w: 1,
  x: 0,
  y: 0,
  z: 0,
}
/** how near the helmet has to come to something to touch it, in meters */
const contactReach = 0.005
/** how fast the helmet flies off, in m/s: on along the fall where the suit strikes the floor, back off a wall it strikes still half upright, off to the side, so it never wedges between the suit and the wall, and up, on top of how much of the collar’s own speed it keeps */
const throwSpeed = 0.7
const rebound = 1.2
const throwAside = 1.3
const throwLift = 1.4
const keptSpeed = 0.6
/** how fast it tumbles off, in radians per second */
const tumble = 7
/** how far the suit has to lean before it lies so flat that the helmet goes even without a knock, in degrees */
const lying = 70
/** how far the suit leans at most when what it strikes counts as a wall rather than the floor, in degrees */
const walled = 65
/** how often at most the helmet is thrown off again where it came to rest on the fallen suit’s shoulders, like where the suit leans into a corner */
const rethrows = 3
/** how slowly the helmet has to move to count as at rest, in m/s */
const resting = 0.05
const up = new Vector3
const turn = new Quaternion
const vertical = new Vector3(0, 1, 0)

/**
 * Keeps the suit of armor’s head on its shoulders until it is pushed over: once it leans further than `suitOfArmor.toppled` and strikes something, like a wall or the floor, or its helmet does, or it lies all but flat, it throws off the helmet still on its shoulders, tumbling: back off a wall it strikes still half upright, on along its fall where it strikes the floor, and off to the side, so the helmet never wedges between the suit and the wall. It loses its head once.
 */
export default class ArmorBeheading {
  /** whether it has lost its head */
  beheaded = false
  #rethrown = 0

  /** `helmet` gives the helmet’s body while it lies about free, neither carried nor held by a fusion. */
  constructor(readonly world: World, readonly body: RigidBody, readonly helmet: () => RigidBody | undefined) {}

  /** How far it leans from upright, in degrees. */
  get lean() {
    this.#readPose()
    return Math.acos(Math.min(1, Math.max(-1, up.y))) * 180 / Math.PI
  }

  /** A knock on the suit by something other than its helmet: it loses its head if it leans far enough. */
  struck(): Knock {
    return this.lean > suitOfArmor.toppled ? this.#behead() : undefined
  }

  /** Every frame after the physics stepped: leaning far enough with its helmet striking something other than itself, or lying all but flat, it loses its head; once it has, a helmet come to rest on its shoulders all the same is thrown off again. */
  update(): Knock {
    if (this.beheaded) {
      return this.#rethrow()
    }
    if (this.body.isSleeping()) {
      return
    }
    const lean = this.lean
    if (lean > lying || lean > suitOfArmor.toppled && this.#helmetStrikes()) {
      return this.#behead()
    }
  }

  #behead(): Knock {
    if (this.beheaded) {
      return
    }
    const helmet = this.helmet()
    if (!helmet || !this.#onShoulders(helmet)) {
      return
    }
    this.beheaded = true
    return this.#throw(helmet)
  }

  /** Whether the helmet touches anything but the suit. */
  #helmetStrikes() {
    const helmet = this.helmet()
    return helmet !== undefined && this.#touches(helmet, other => other.parent()?.handle !== this.body.handle)
  }

  /** Whether the helmet lies on the suit’s shoulders, or near enough. */
  #onShoulders(helmet: RigidBody) {
    this.#readPose()
    const {x, y, z} = this.body.translation()
    const head = helmet.translation()
    return up.clone().multiplyScalar(suitOfArmor.collar).add(new Vector3(x, y, z)).distanceTo(new Vector3(head.x, head.y, head.z)) <= shoulderReach
  }

  #readPose() {
    const {w, x, y, z} = this.body.rotation()
    up.set(0, 1, 0).applyQuaternion(turn.set(x, y, z, w))
  }

  /** Throws off the helmet once more where it came to rest on the fallen suit’s shoulders. */
  #rethrow(): Knock {
    if (this.#rethrown >= rethrows) {
      return
    }
    const helmet = this.helmet()
    if (!helmet) {
      return
    }
    const {x, y, z} = helmet.linvel()
    if (Math.hypot(x, y, z) > resting || this.lean < suitOfArmor.toppled || !this.#onShoulders(helmet) || !this.#touchesSuit(helmet)) {
      return
    }
    this.#rethrown++
    return this.#throw(helmet)
  }

  /** How far the helmet could fly along the level `direction` before striking anything but the suit and itself, up to a few meters. */
  #room(helmet: RigidBody, direction: Vector3) {
    const reach = 3
    const hit = this.world.castShape(helmet.translation(), unturned, direction, new Ball(helmetRadius), 0, reach, false, undefined, undefined, undefined, undefined, collider => {
      const owner = collider.parent()?.handle
      return owner !== helmet.handle && owner !== this.body.handle && !collider.isSensor()
    })
    return hit?.time_of_impact ?? reach
  }

  /** Throws the helmet off the suit’s shoulders. */
  #throw(helmet: RigidBody): Knock {
    const lean = this.lean
    const collar = up.clone().multiplyScalar(suitOfArmor.collar)
    const fall = new Vector3(up.x, 0, up.z)
    if (fall.lengthSq() < 1e-8) {
      fall.set(0, 0, -1)
    }
    fall.normalize()
    // The collar’s own velocity: the body’s, and its spin round its middle
    const linear = this.body.linvel()
    const spin = this.body.angvel()
    const velocity = new Vector3(spin.x, spin.y, spin.z)
    velocity.cross(collar).add(linear).multiplyScalar(keptSpeed)
    const axis = new Vector3
    axis.crossVectors(vertical, fall).normalize()
    // Off to the side with more room
    const aside = axis.clone()
    if (this.#room(helmet, aside) < this.#room(helmet, aside.clone().negate())) {
      aside.negate()
    }
    if (lean < walled) {
      // The wall stops whatever of it still heads into the wall.
      velocity.addScaledVector(fall, -Math.max(0, velocity.dot(fall)) - rebound)
    } else {
      velocity.addScaledVector(fall, throwSpeed)
    }
    velocity.addScaledVector(aside, throwAside)
    velocity.y = Math.max(velocity.y, 0) + throwLift
    helmet.setLinvel(velocity, true)
    helmet.setAngvel({
      x: axis.x * tumble,
      y: 0.8,
      z: axis.z * tumble,
    }, true)
    return {
      direction: fall.toArray(),
      velocity: velocity.toArray(),
    }
  }

  /** Whether the helmet touches any collider that is no sensor and passes `which`. */
  #touches(helmet: RigidBody, which: (other: Collider) => boolean) {
    const {world} = this
    let touching = false
    for (let index = 0; index < helmet.numColliders(); index++) {
      const own = helmet.collider(index)
      world.contactPairsWith(own, other => {
        if (touching || other.isSensor() || !which(other)) {
          return
        }
        world.contactPair(own, other, manifold => {
          for (let point = 0; point < manifold.numContacts(); point++) {
            if (manifold.contactDist(point) < contactReach) {
              touching = true
            }
          }
        })
      })
    }
    return touching
  }

  /** Whether the helmet touches the suit. */
  #touchesSuit(helmet: RigidBody) {
    return this.#touches(helmet, other => other.parent()?.handle === this.body.handle)
  }
}
