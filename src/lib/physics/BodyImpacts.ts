import type {Collider, RigidBody, TempContactManifold, World} from '@dimforge/rapier3d-compat'

import {Quaternion, Vector3} from 'three/webgpu'

/** a registered body striking something within one physics step */
export type BodyImpact<Tag> = {
  body: RigidBody
  /** the contact’s normal in world space, from the body toward what it struck */
  normal: Vector3
  /** the tag of the body it struck, if that is registered too */
  other?: Tag
  /** where they touched, in world meters */
  point: Vector3
  /** how the body was turned right before, as it struck */
  rotation: Quaternion
  /** how fast the two closed in on each other along the normal right before, in m/s */
  speed: number
  tag: Tag
}
/** how a body moved and where it was right before a step */
type Motion = {
  angular: Vector3
  center: Vector3
  linear: Vector3
  position: Vector3
  rotation: Quaternion
}
type Entry<Tag> = {
  body: RigidBody
  /** the physics step it last struck something in */
  lastStrike: number
  /** its motion right before the current step, while it is awake */
  motion: Motion
  /** whether it moved into the current step, awake and dynamic, so that it may strike something */
  moving: boolean
  /** how fast it moved right before each of the last {@link BodyImpacts.touchSteps} steps, in m/s, the latest last */
  speeds: Array<number>
  tag: Tag
}
/** the strongest contact of one body found so far within a step */
type Strike = {
  normal: Vector3
  other?: RigidBody
  point: Vector3
  speed: number
}

const relative = new Vector3
const lever = new Vector3
const spin = new Vector3
const normal = new Vector3
const point = new Vector3
const placement = new Vector3
const turn = new Quaternion
const unturn = new Quaternion
const attached = new Quaternion
const otherMotion = motion()
/** room for the motion of a body */
function motion(): Motion {
  return {
    angular: new Vector3,
    center: new Vector3,
    linear: new Vector3,
    position: new Vector3,
    rotation: new Quaternion,
  }
}
/** Takes the motion of `body` as it is now into `target`. */
function take(body: RigidBody, target: Motion) {
  const {x, y, z, w} = body.rotation()
  target.linear.copy(body.linvel())
  target.angular.copy(body.angvel())
  target.center.copy(body.worldCom())
  target.position.copy(body.translation())
  target.rotation.set(x, y, z, w)
  return target
}
/** How fast the point `at` of a body moving as `motion` moves, into `target`. */
function pointVelocity(moving: Motion, at: Vector3, target: Vector3) {
  return target.crossVectors(moving.angular, lever.subVectors(at, moving.center)).add(moving.linear)
}

/**
 * Hears what registered bodies strike: before each physics step it takes the motion of every awake one, and after it, for every point of contact the solver pushed apart that had not touched within {@link touchSteps} steps, how fast both sides closed in there along the contact’s normal right before, reporting a body’s hardest strike of the step once it is faster than {@link threshold}.
 * The solver has already bounced the bodies by the time Rapier reports a collision, so their velocities then tell little; and a body rolling along a floor that is one collider with its walls never starts a new collision when it hits a wall.
 * Points that keep touching, like the corner of a work sliding down a wall while it spins, strike only once, and a work tipping over strikes with every corner it lands on. A body strikes at most once per {@link cooldown}, and two registered bodies striking each other count once.
 */
export default class BodyImpacts<Tag> {
  private readonly entries = new Map<number, Entry<Tag>>
  private steps = 0
  /** the step every point of contact last touched in, by its colliders, their subshapes and their features */
  private readonly touched = new Map<string, number>

  /** `cooldown` in seconds, `threshold` in m/s, `touchSteps` in physics steps */
  constructor(private readonly onImpact: (impact: BodyImpact<Tag>) => void, private readonly threshold = 0.25, private readonly cooldown = 0.03, private readonly touchSteps = 4) {}

  /** Takes the motion of every registered body right before a step; call it from `useBeforePhysicsStep`. */
  capture(_world: World) {
    this.steps++
    for (const entry of this.entries.values()) {
      const {body} = entry
      entry.moving = body.isValid() && body.isEnabled() && body.isDynamic() && !body.isSleeping()
      if (entry.moving) {
        take(body, entry.motion)
      }
      entry.speeds.push(entry.moving ? entry.motion.linear.length() : 0)
      if (entry.speeds.length > this.touchSteps) {
        entry.speeds.shift()
      }
    }
  }

  /** Reports what the registered bodies struck in the step that just ran; call it from `useAfterPhysicsStep`. */
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
      const struck = strike.other && this.entries.get(strike.other.handle)
      if (struck) {
        struck.lastStrike = this.steps
      }
      this.onImpact({
        body: entry.body,
        tag: entry.tag,
        other: struck?.tag,
        normal: strike.normal,
        point: strike.point,
        rotation: entry.motion.rotation.clone(),
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

  /** The fastest the registered `body` moved right before any of the last {@link touchSteps} steps, in m/s, which a collision reported after the solver bounced it still finds, or undefined for a body that isn’t registered. */
  recentSpeed(body: RigidBody) {
    const entry = this.entries.get(body.handle)
    return entry && Math.max(0, ...entry.speeds)
  }

  /** Hears what `body` strikes as `tag` until the returned function is called. */
  register(body: RigidBody, tag: Tag) {
    const {handle} = body
    const entry: Entry<Tag> = {
      body,
      tag,
      lastStrike: Number.NEGATIVE_INFINITY,
      moving: false,
      motion: motion(),
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
          const {x, y, z, w} = body.rotation()
          unturn.set(x, y, z, w).invert()
          const {x: cx, y: cy, z: cz, w: cw} = collider.rotation()
          turn.copy(ours.rotation).multiply(unturn).multiply(attached.set(cx, cy, cz, cw))
          placement.copy(collider.translation()).sub(body.translation()).applyQuaternion(unturn).applyQuaternion(ours.rotation).add(ours.position)
          // The manifold’s normal points away from its first collider, which is the other one if it is flipped.
          normal.copy(manifold.normal())
          if (flipped) {
            normal.negate()
          }
          const otherEntry = otherBody && this.entries.get(otherBody.handle)
          if (otherEntry?.moving) {
            theirs = otherEntry.motion
          } else if (otherBody && !otherBody.isFixed()) {
            theirs = take(otherBody, otherMotion)
          }
        }
        point.copy((flipped ? manifold.localContactPoint2(i) : manifold.localContactPoint1(i))!).applyQuaternion(turn).add(placement)
        pointVelocity(ours, point, relative)
        if (theirs) {
          relative.sub(pointVelocity(theirs, point, spin))
        }
        const speed = relative.dot(normal)
        if (speed > (strike?.speed ?? 0)) {
          strike = {
            speed,
            other: otherBody ?? undefined,
            normal: normal.clone(),
            point: point.clone(),
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
