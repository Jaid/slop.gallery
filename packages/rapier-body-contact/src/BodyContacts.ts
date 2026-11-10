import type {Rotation, Vector} from './lib/math.ts'
import type {Collider, RigidBody, TempContactManifold, World} from '@dimforge/rapier3d-compat'

import {copy, cross, dot, invert, makeRotation, makeVector, multiply, rotate} from './lib/math.ts'

/** a registered body striking something within one physics step */
export type BodyContact<Tag> = {
  body: RigidBody
  /** the collider of the body that struck */
  collider: Collider
  /** the contact’s normal in world space, from the body toward what it struck */
  normal: Vector
  /** the tag of the body it struck, if that is registered too */
  other?: Tag
  /** the body it struck, if what it struck belongs to one */
  otherBody?: RigidBody
  /** the collider it struck */
  otherCollider: Collider
  /** where they touched, in world space */
  point: Vector
  /** how the body was turned right before, as it struck; turned back by it, the {@link normal} tells which side of the body struck */
  rotation: Rotation
  /** how fast the two closed in on each other along the normal right before, in units per second */
  speed: number
  tag: Tag
}
export type BodyContactsOptions<Tag> = {
  /** the least time between two strikes of a body, in seconds, by default 0.03 */
  cooldown?: number
  /** Gets every strike, from within {@link BodyContacts.collect}. */
  onContact: (contact: BodyContact<Tag>) => void
  /** the speed a strike has to be faster than, in units per second, by default 0.25 */
  threshold?: number
  /** how many physics steps a point of contact must not have touched for to strike again, by default 4 */
  touchSteps?: number
}
/** how a body moved and where it was right before a step */
type Motion = {
  angular: Vector
  center: Vector
  linear: Vector
  position: Vector
  rotation: Rotation
}
type Entry<Tag> = {
  body: RigidBody
  /** the physics step it last struck something in */
  lastStrike: number
  /** its motion right before the current step, while it is awake */
  motion: Motion
  /** whether it moved into the current step, awake and dynamic, so that it may strike something */
  moving: boolean
  /** how fast it moved right before each of the last `touchSteps` steps, the latest last */
  speeds: Array<number>
  tag: Tag
}
/** the strongest contact of one body found so far within a step */
type Strike = {
  collider: Collider
  normal: Vector
  otherBody?: RigidBody
  otherCollider: Collider
  point: Vector
  speed: number
}

const relative = makeVector()
const lever = makeVector()
const spin = makeVector()
const normal = makeVector()
const point = makeVector()
const placement = makeVector()
const turn = makeRotation()
const unturn = makeRotation()
/** room for the motion of a body */
function makeMotion(): Motion {
  return {
    angular: makeVector(),
    center: makeVector(),
    linear: makeVector(),
    position: makeVector(),
    rotation: makeRotation(),
  }
}
const otherMotion = makeMotion()
/** Takes the motion of `body` as it is now into `target`. */
function take(body: RigidBody, target: Motion) {
  copy(target.linear, body.linvel())
  copy(target.angular, body.angvel())
  copy(target.center, body.worldCom())
  copy(target.position, body.translation())
  copy(target.rotation, body.rotation())
  return target
}
/** How fast the point `at` of a body moving as `motion` moves, into `target`. */
function pointVelocity(motion: Motion, at: Vector, target: Vector) {
  lever.x = at.x - motion.center.x
  lever.y = at.y - motion.center.y
  lever.z = at.z - motion.center.z
  cross(target, motion.angular, lever)
  target.x += motion.linear.x
  target.y += motion.linear.y
  target.z += motion.linear.z
  return target
}

/**
 * Tells what registered bodies strike: before each physics step it takes the motion of every awake one, and after it, for every point of contact the solver pushed apart that had not touched within the last `touchSteps` steps, how fast both sides closed in there along the contact’s normal right before, reporting a body’s hardest strike of the step once it is faster than the `threshold`.
 * The solver has already bounced the bodies by the time Rapier reports a collision, so their velocities then tell little; and a body rolling along a floor that is one collider with its walls never starts a new collision when it hits a wall.
 * Points that keep touching, like the corner of a box sliding down a wall while it spins, strike only once, and a box tipping over strikes with every corner it lands on. A body strikes at most once per `cooldown`, and two registered bodies striking each other count once.
 */
export default class BodyContacts<Tag = undefined> {
  private readonly cooldown: number
  private readonly entries = new Map<number, Entry<Tag>>
  private readonly onContact: (contact: BodyContact<Tag>) => void
  private steps = 0
  private readonly threshold: number
  /** the step every point of contact last touched in, by its colliders, their subshapes and their features */
  private readonly touched = new Map<string, number>
  private readonly touchSteps: number

  constructor({cooldown = 0.03, onContact, threshold = 0.25, touchSteps = 4}: BodyContactsOptions<Tag>) {
    this.cooldown = cooldown
    this.onContact = onContact
    this.threshold = threshold
    this.touchSteps = touchSteps
  }

  /** Takes the motion of every registered body; call it right before every step of the world. */
  capture() {
    this.steps++
    for (const entry of this.entries.values()) {
      const {body} = entry
      entry.moving = body.isValid() && body.isEnabled() && body.isDynamic() && !body.isSleeping()
      if (entry.moving) {
        take(body, entry.motion)
      }
      entry.speeds.push(entry.moving ? Math.hypot(entry.motion.linear.x, entry.motion.linear.y, entry.motion.linear.z) : 0)
      if (entry.speeds.length > this.touchSteps) {
        entry.speeds.shift()
      }
    }
  }

  /** Reports what the registered bodies struck in the step that just ran; call it right after every step of the world. */
  collect(world: World) {
    const cooldown = Math.ceil(this.cooldown / world.timestep)
    for (const entry of this.entries.values()) {
      if (!entry.moving || !entry.body.isValid()) {
        continue
      }
      // Measured even while it cools down, so the points it keeps touching count as touching.
      const strike = this.strongest(world, entry)
      if (!strike || strike.speed < this.threshold || this.steps - entry.lastStrike < cooldown) {
        continue
      }
      entry.lastStrike = this.steps
      const struck = strike.otherBody && this.entries.get(strike.otherBody.handle)
      if (struck) {
        struck.lastStrike = this.steps
      }
      this.onContact({
        body: entry.body,
        tag: entry.tag,
        collider: strike.collider,
        other: struck?.tag,
        otherBody: strike.otherBody,
        otherCollider: strike.otherCollider,
        normal: strike.normal,
        point: strike.point,
        rotation: {...entry.motion.rotation},
        speed: strike.speed,
      })
    }
    if (this.touched.size > 1024) {
      for (const [key, step] of this.touched) {
        if (this.steps - step > this.touchSteps) {
          this.touched.delete(key)
        }
      }
    }
  }

  /** The fastest the registered `body` moved right before any of the last `touchSteps` steps, which a collision event, reported after the solver bounced the body, still finds, or undefined for a body that isn’t registered. */
  recentSpeed(body: RigidBody) {
    const entry = this.entries.get(body.handle)
    return entry && Math.max(0, ...entry.speeds)
  }

  /** Tells what `body` strikes, as `tag`, until the returned function is called. */
  register(body: RigidBody, ...[tag]: undefined extends Tag ? [tag?: Tag] : [tag: Tag]) {
    const {handle} = body
    const entry: Entry<Tag> = {
      body,
      tag: tag as Tag,
      lastStrike: Number.NEGATIVE_INFINITY,
      moving: false,
      motion: makeMotion(),
      speeds: [],
    }
    this.entries.set(handle, entry)
    return () => {
      if (this.entries.get(handle) === entry) {
        this.entries.delete(handle)
      }
    }
  }

  /** The hardest strike of the points of contact the solver pushed `entry`’s body apart at in the last step, or undefined for none. */
  private strongest(world: World, entry: Entry<Tag>) {
    const {body, motion: ours} = entry
    let strike: Strike | undefined
    const measure = (collider: Collider, other: Collider, manifold: TempContactManifold, flipped: boolean) => {
      const otherBody = other.parent()
      let pose = false
      let theirs: Motion | undefined
      for (let i = 0; i < manifold.numContacts(); i++) {
        if (manifold.contactImpulse(i) <= 0) {
          continue
        }
        // Flipped, the manifold’s second side is the body’s own collider. Keys name the lower collider first, so either side finds the same point.
        const [ownSubshape, otherSubshape] = flipped ? [manifold.subshape2(), manifold.subshape1()] : [manifold.subshape1(), manifold.subshape2()]
        const [ownFeature, otherFeature] = flipped ? [manifold.contactFid2(i), manifold.contactFid1(i)] : [manifold.contactFid1(i), manifold.contactFid2(i)]
        const key = collider.handle < other.handle ? `${collider.handle}:${other.handle}:${ownSubshape}:${otherSubshape}:${ownFeature}:${otherFeature}` : `${other.handle}:${collider.handle}:${otherSubshape}:${ownSubshape}:${otherFeature}:${ownFeature}`
        const last = this.touched.get(key)
        this.touched.set(key, this.steps)
        if (last !== undefined && this.steps - last <= this.touchSteps) {
          continue
        }
        if (!pose) {
          pose = true
          // The contacts lie in the collider’s own space as it was right before the step, which the body has moved on from since; solver contacts are read back where the body is now, a step’s turn off for anything spinning.
          invert(unturn, body.rotation())
          multiply(turn, multiply(turn, ours.rotation, unturn), collider.rotation())
          const colliderPosition = collider.translation()
          const bodyPosition = body.translation()
          placement.x = colliderPosition.x - bodyPosition.x
          placement.y = colliderPosition.y - bodyPosition.y
          placement.z = colliderPosition.z - bodyPosition.z
          rotate(placement, rotate(placement, placement, unturn), ours.rotation)
          placement.x += ours.position.x
          placement.y += ours.position.y
          placement.z += ours.position.z
          // The manifold’s normal points away from its first collider, which is the other one if it is flipped.
          const direction = flipped ? -1 : 1
          const manifoldNormal = manifold.normal()
          normal.x = manifoldNormal.x * direction
          normal.y = manifoldNormal.y * direction
          normal.z = manifoldNormal.z * direction
          const otherEntry = otherBody && this.entries.get(otherBody.handle)
          if (otherEntry?.moving) {
            theirs = otherEntry.motion
          } else if (otherBody && !otherBody.isFixed()) {
            theirs = take(otherBody, otherMotion)
          }
        }
        rotate(point, (flipped ? manifold.localContactPoint2(i) : manifold.localContactPoint1(i))!, turn)
        point.x += placement.x
        point.y += placement.y
        point.z += placement.z
        pointVelocity(ours, point, relative)
        if (theirs) {
          pointVelocity(theirs, point, spin)
          relative.x -= spin.x
          relative.y -= spin.y
          relative.z -= spin.z
        }
        const speed = dot(relative, normal)
        if (speed > (strike?.speed ?? 0)) {
          strike = {
            speed,
            collider,
            otherBody: otherBody ?? undefined,
            otherCollider: other,
            normal: {...normal},
            point: {...point},
          }
        }
      }
    }
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i)
      world.contactPairsWith(collider, other => {
        const otherBody = other.parent()
        if (otherBody?.handle === body.handle) {
          return
        }
        // Two registered bodies striking each other count once, from the one with the lower handle.
        if (otherBody && otherBody.handle < body.handle && this.entries.get(otherBody.handle)?.moving) {
          return
        }
        world.contactPair(collider, other, (manifold, flipped) => measure(collider, other, manifold, flipped))
      })
    }
    return strike
  }
}
