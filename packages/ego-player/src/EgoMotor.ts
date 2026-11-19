import type {EgoOptions} from './options.ts'
import type {EgoImpact, EgoInput, EgoPoint, EgoPosition, EgoState} from './types.ts'
import type {RapierCollider, RapierContext, RapierRigidBody} from '@react-three/rapier'
import type {Quaternion} from 'three/webgpu'

import {Vector3} from 'three/webgpu'

import {approachHorizontal, clamp, getCapsuleHalfHeight, getJumpVelocity} from './math.ts'
import {resolveEgoOptions} from './options.ts'

const up = new Vector3(0, 1, 0)
const minimumImpactSpeed = 0.01
const identityRotation = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
}

/**
  * Owns one Rapier character controller, not the supplied world, body or collider.
  */
export default class EgoMotor {
  private active = false
  private airborneTime = 0
  private clock = 0
  private readonly controller
  private disposed = false
  private readonly forward = new Vector3
  private freshClearance = false
  private readonly freshImpacts: Array<EgoImpact> = []
  private hadGroundContact = false
  private isCrouching = false
  private isFlying = false
  private isGrounded = false
  private jumpBufferedUntil = Number.NEGATIVE_INFINITY
  private jumpHeld = false
  /** whether the upward velocity comes from a jump, which releasing the button cuts short, rather than from a fling */
  private jumping = false
  private lastGroundedAt = Number.NEGATIVE_INFINITY
  private lastLandingSpeed = 0
  private readonly movement = new Vector3
  private options = resolveEgoOptions()
  private readonly physicalVelocity = new Vector3
  private readonly push = new Vector3
  private readonly right = new Vector3
  private shapeHeight = 0
  private shapeRadius = 0
  private readonly targetVelocity = new Vector3
  /** handles of the colliders touched on the latest step, so that only first contacts count as impacts */
  private touched = new Set<number>
  private readonly velocity = new Vector3
  private verticalVelocity = 0

  constructor(private readonly rapier: RapierContext['rapier'], private readonly world: RapierContext['world'], readonly body: RapierRigidBody, private readonly collider: RapierCollider, options: EgoOptions = {}) {
    // Validate before allocating a WASM-owned controller.
    this.options = resolveEgoOptions(options)
    this.controller = world.createCharacterController(Math.max(this.options.contactOffset, 0.001))
    this.configure(options)
  }

  get crouching() {
    return this.isCrouching
  }

  get crouchingHeight() {
    return clamp(this.options.crouchHeight, this.radius * 2, this.standingHeight)
  }

  get flying() {
    return this.isFlying
  }

  get grounded() {
    return this.isGrounded
  }

  get horizontalSpeed() {
    return Math.hypot(this.physicalVelocity.x, this.physicalVelocity.z)
  }

  /** Obstacles first touched on the latest step, ground included. */
  get impacts(): ReadonlyArray<EgoImpact> {
    return this.freshImpacts
  }

  /** Downward speed before impact on the latest step; zero without a new landing. */
  get landingSpeed() {
    return this.lastLandingSpeed
  }

  get radius() {
    return Math.max(this.options.radius, 0.01)
  }

  get standingHeight() {
    return Math.max(this.options.height, this.radius * 2)
  }

  configure(options: EgoOptions) {
    this.options = resolveEgoOptions(options)
    const o = this.options
    this.controller.setOffset(Math.max(o.contactOffset, 0.001))
    this.controller.setSlideEnabled(true)
    // Rapier's own impulses re-hit a blocked body at full requested speed every step, an unbounded force that crushes light bodies through whatever supports them.
    this.controller.setApplyImpulsesToDynamicBodies(false)
    this.controller.setCharacterMass(o.characterMass)
    this.controller.setMaxSlopeClimbAngle(clamp(o.maxSlopeAngle, 0, 89.9) * Math.PI / 180)
    this.controller.setMinSlopeSlideAngle(clamp(o.slideAngle, 0, 89.9) * Math.PI / 180)
    if (o.stepHeight > 0 && o.stepMinWidth > 0) {
      this.controller.enableAutostep(o.stepHeight, o.stepMinWidth, false)
    } else {
      this.controller.disableAutostep()
    }
    if (o.snapToGround > 0) {
      this.controller.enableSnapToGround(o.snapToGround)
    } else {
      this.controller.disableSnapToGround()
    }
    this.collider.setCollisionGroups(o.collisionGroups ?? 0xFF_FF_FF_FF)
    this.updateShape()
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.world.removeCharacterController(this.controller)
  }

  /**
   * Flings the character off with `velocity`, replacing its momentum, as a blast or a springy obstacle would. It flies on under gravity and air control from the next step, and releasing jump doesn’t cut an upward fling short.
   * An upward fling lifts it off the ground and spends its coyote time; on the ground, a level one slides it away under the ground’s deceleration. Does nothing while flying.
   */
  fling(velocity: EgoPoint) {
    if (![velocity.x, velocity.y, velocity.z].every(Number.isFinite)) {
      throw new RangeError('ego-player: fling velocity must be finite.')
    }
    if (this.disposed || this.isFlying) {
      return
    }
    this.velocity.set(velocity.x, 0, velocity.z)
    this.verticalVelocity = velocity.y
    this.jumping = false
    if (velocity.y > 0) {
      this.isGrounded = false
      this.lastGroundedAt = Number.NEGATIVE_INFINITY
    }
  }

  getState(): EgoState {
    return {
      active: this.active,
      crouching: this.isCrouching,
      flying: this.isFlying,
      grounded: this.isGrounded,
      position: {...this.body.translation()},
      velocity: {
        x: this.physicalVelocity.x,
        y: this.physicalVelocity.y,
        z: this.physicalVelocity.z,
      },
    }
  }

  /** `flying` moves freely along the camera direction, without gravity or collisions. Leaving it falls from the current position. */
  step(delta: number, input: EgoInput, rotation: Quaternion, active = true, flying = false) {
    this.lastLandingSpeed = 0
    this.freshImpacts.length = 0
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) {
      return
    }
    const o = this.options
    const dt = Math.min(delta, Math.max(o.maxDelta, 1 / 240))
    this.clock += dt
    const now = this.clock
    this.active = active
    if (flying) {
      this.touched.clear()
      this.fly(dt, delta, input, rotation)
      return
    }
    if (this.isFlying) {
      this.land()
    }
    const jumpHeld = active && !!input.jump
    if (!active) {
      this.jumpBufferedUntil = Number.NEGATIVE_INFINITY
    } else if (jumpHeld && !this.jumpHeld) {
      this.jumpBufferedUntil = now + Math.max(o.jumpBufferTime, 0)
    }
    if (!jumpHeld && this.jumpHeld && this.jumping && this.verticalVelocity > 0) {
      this.verticalVelocity *= clamp(o.jumpReleaseFactor, 0, 1)
    }
    this.jumpHeld = jumpHeld
    const wantsCrouch = active && !!input.crouch
    if (wantsCrouch) {
      this.isCrouching = true
    } else if (this.isCrouching) {
      const feet = this.body.translation()
      const {Capsule} = this.rapier
      const standingShape = new Capsule(getCapsuleHalfHeight(this.standingHeight, this.radius), this.radius)
      const obstruction = this.world.intersectionWithShape({
        x: feet.x,
        y: feet.y + this.standingHeight / 2,
        z: feet.z,
      }, identityRotation, standingShape, this.rapier.QueryFilterFlags.EXCLUDE_SENSORS, o.collisionGroups, this.collider, this.body)
      if (!obstruction && (!this.freshClearance || this.canOccupy([feet.x, feet.y, feet.z], this.standingHeight))) {
        this.isCrouching = false
      }
    }
    this.freshClearance = false
    // Resize synchronously before movement and clearance checks in the next substep.
    this.updateShape()
    const inputForward = active ? Number(!!input.forward) - Number(!!input.backward) : 0
    const inputRight = active ? Number(!!input.right) - Number(!!input.left) : 0
    const hasInput = inputForward !== 0 || inputRight !== 0
    let speedFactor = 1
    let jumpFactor = 1
    if (this.isCrouching) {
      speedFactor = o.crouchFactor
      jumpFactor = o.crouchJumpFactor
    } else if (active && input.sprint) {
      // Resolve opposing keys first; forward diagonals sprint, other movement dodges.
      const dodging = hasInput && inputForward <= 0
      speedFactor = dodging ? o.dodgeFactor : o.sprintFactor
      jumpFactor = dodging ? o.dodgeJumpFactor : o.sprintJumpFactor
    }
    this.targetVelocity.set(0, 0, 0)
    if (hasInput) {
      this.forward.set(0, 0, -1).applyQuaternion(rotation)
      this.forward.y = 0
      if (this.forward.lengthSq() < 0.000001) {
        // Camera-local right retains yaw even at the vertical look limit.
        this.right.set(1, 0, 0).applyQuaternion(rotation)
        this.forward.crossVectors(up, this.right).normalize()
      } else {
        this.forward.normalize()
      }
      this.right.crossVectors(this.forward, up).normalize()
      this.targetVelocity.addScaledVector(this.forward, inputForward).addScaledVector(this.right, inputRight).normalize()
      this.targetVelocity.multiplyScalar(Math.max(o.speed * speedFactor, 0))
    }
    const grounded = this.isGrounded
    const acceleration = grounded ? o.acceleration : o.airAcceleration
    const deceleration = grounded ? o.deceleration : o.airDeceleration
    const responsiveness = hasInput ? acceleration : deceleration
    approachHorizontal(this.velocity, this.targetVelocity, Math.max(responsiveness, 0) * dt)
    if (grounded) {
      this.lastGroundedAt = now
    }
    const canJump = grounded || now - this.lastGroundedAt <= Math.max(o.coyoteTime, 0)
    if (this.jumpBufferedUntil >= now && canJump) {
      this.verticalVelocity = getJumpVelocity(o.jumpHeight * jumpFactor, o.gravity)
      this.jumping = true
      this.jumpBufferedUntil = Number.NEGATIVE_INFINITY
      // Consume coyote time too, so release/repress cannot double-jump.
      this.lastGroundedAt = Number.NEGATIVE_INFINITY
      this.isGrounded = false
    } else if (grounded) {
      this.verticalVelocity = -Math.max(o.groundStickSpeed, 0)
    } else {
      const gravityFactor = this.verticalVelocity < 0 ? Math.max(o.fallGravityFactor, 0) : 1
      this.verticalVelocity = Math.max(this.verticalVelocity - Math.max(o.gravity, 0) * gravityFactor * dt, -Math.max(o.maxSpeedDown, 0))
    }
    this.movement.set(this.velocity.x * dt, this.verticalVelocity * dt, this.velocity.z * dt)
    this.controller.computeColliderMovement(this.collider, this.movement, this.rapier.QueryFilterFlags.EXCLUDE_SENSORS, o.collisionGroups)
    this.collectImpacts(!grounded)
    if (o.pushDynamicBodies) {
      this.pushDynamicBodies(dt)
    }
    const movement = this.controller.computedMovement()
    // Measure against the actual physics interval, even when integration catch-up is capped.
    this.physicalVelocity.set(movement.x / delta, movement.y / delta, movement.z / delta)
    const translation = this.body.translation()
    this.body.setNextKinematicTranslation({
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z,
    })
    // Keep requested horizontal momentum separate from collision-resolved velocity. Autostep can spend a tick lifting the capsule; feeding that short horizontal displacement back into acceleration makes every riser behave like a wall. Physical velocity above still reports only the movement that actually happened.
    // Rapier can still report the takeoff floor within its contact distance at high tick rates.
    // Positive jump velocity is airborne even during those first short upward displacements.
    this.isGrounded = this.verticalVelocity <= 0 && this.controller.computedGrounded()
    if (this.isGrounded) {
      // Suppress initial placement and brief contact flicker on stairs/slopes.
      if (!grounded && this.hadGroundContact && this.airborneTime >= 0.06) {
        this.lastLandingSpeed = Math.max(0, -this.verticalVelocity)
      }
      this.hadGroundContact = true
      this.airborneTime = 0
      this.jumping = false
      this.lastGroundedAt = now
      if (this.verticalVelocity < 0) {
        this.verticalVelocity = 0
      }
    } else {
      this.airborneTime += dt
      if (this.movement.y > 0 && movement.y + 0.0001 < this.movement.y) {
        this.verticalVelocity = 0
      }
    }
  }

  /**
   * Puts the feet at `position`, or at `fallback` where the capsule fits neither standing nor crouching, and throws where it fits at neither. Returns where it put them.
   * `flying`, as the next {@link step} goes on, by default as the last one went, takes off or lands first. Flying, it goes anywhere, upright: nothing is in the way of a capsule out of the physics.
   */
  teleport(position: EgoPosition, fallback?: EgoPosition, flying = this.isFlying): EgoPosition {
    if (!position.every(Number.isFinite) || fallback && !fallback.every(Number.isFinite)) {
      throw new RangeError('ego-player: teleport position must be finite.')
    }
    if (flying) {
      this.takeOff()
      this.isCrouching = false
    } else {
      // Direct collider queries also see newly mounted/moved geometry before the first world step.
      this.world.propagateModifiedBodyPositionsToColliders()
      const destinations = fallback ? [position, fallback] : [position]
      let selected: {
        crouching: boolean
        position: EgoPosition
      } | undefined
      for (const destination of destinations) {
        if (!this.isCrouching && this.canOccupy(destination, this.standingHeight)) {
          selected = {
            position: destination,
            crouching: false,
          }
        } else if (this.canOccupy(destination, this.crouchingHeight)) {
          selected = {
            position: destination,
            crouching: true,
          }
        }
        if (selected) {
          break
        }
      }
      if (!selected) {
        throw new RangeError('ego-player: neither the destination nor its fallback fits the player capsule.')
      }
      if (this.isFlying) {
        this.land()
      }
      position = selected.position
      this.isCrouching = selected.crouching
    }
    this.freshClearance = true
    this.updateShape()
    const translation = {
      x: position[0],
      y: position[1],
      z: position[2],
    }
    this.body.setTranslation(translation, true)
    this.body.setNextKinematicTranslation(translation)
    this.world.propagateModifiedBodyPositionsToColliders()
    this.body.setLinvel({
      x: 0,
      y: 0,
      z: 0,
    }, true)
    this.velocity.set(0, 0, 0)
    this.physicalVelocity.set(0, 0, 0)
    this.verticalVelocity = 0
    this.jumping = false
    this.airborneTime = 0
    this.hadGroundContact = false
    this.lastLandingSpeed = 0
    this.freshImpacts.length = 0
    this.touched.clear()
    this.isGrounded = false
    this.lastGroundedAt = Number.NEGATIVE_INFINITY
    this.jumpBufferedUntil = Number.NEGATIVE_INFINITY
    // Keep the physical button latch: a held jump is not a new press after teleport.
    const [x, y, z] = position
    return [x, y, z]
  }

  private canOccupy(position: EgoPosition, height: number) {
    const {Capsule} = this.rapier
    // Inset by 0.1 mm so resting contact/float32 noise is not mistaken for penetration.
    const shape = new Capsule(getCapsuleHalfHeight(height, this.radius), this.radius - 0.0001)
    const center = {
      x: position[0],
      y: position[1] + height / 2,
      z: position[2],
    }
    const groups = this.options.collisionGroups ?? 0xFF_FF_FF_FF
    let clear = true
    this.world.forEachCollider(candidate => {
      if (!clear || candidate.handle === this.collider.handle || candidate.parent()?.handle === this.body.handle || !candidate.isEnabled() || candidate.parent()?.isEnabled() === false || candidate.isSensor()) {
        return
      }
      const otherGroups = candidate.collisionGroups()
      if (!(groups >>> 16 & otherGroups & 0xFF_FF) || !(otherGroups >>> 16 & groups & 0xFF_FF)) {
        return
      }
      // GJK intersection tests can report a small positive separation as overlap.
      // Signed contact distance distinguishes a resting floor from actual penetration.
      const contact = candidate.contactShape(shape, center, identityRotation, 0)
      if (contact && contact.distance < 0) {
        clear = false
      }
    })
    return clear
  }

  private collectImpacts(airborne: boolean) {
    const touched = new Set<number>
    for (let index = 0; index < this.controller.numComputedCollisions(); index++) {
      const collision = this.controller.computedCollision(index)
      const collider = collision?.collider
      if (!collision || !collider || touched.has(collider.handle)) {
        continue
      }
      touched.add(collider.handle)
      if (this.touched.has(collider.handle)) {
        continue
      }
      // Still the velocity of the previous step: the motion that led into the contact, not the requested momentum, which stays high while pressing against a wall.
      const {normal1, witness1} = collision
      const speed = -(this.physicalVelocity.x * normal1.x + this.physicalVelocity.y * normal1.y + this.physicalVelocity.z * normal1.z)
      // Contact flicker while resting against an obstacle comes back at float noise speed.
      if (speed > minimumImpactSpeed) {
        this.freshImpacts.push({
          airborne,
          collider,
          normal: {...normal1},
          point: {...witness1},
          speed,
        })
      }
    }
    this.touched = touched
  }

  private fly(dt: number, delta: number, input: EgoInput, rotation: Quaternion) {
    const o = this.options
    this.takeOff()
    const active = this.active
    // Latch jump so that holding Space while landing does not jump.
    this.jumpHeld = active && !!input.jump
    this.jumpBufferedUntil = Number.NEGATIVE_INFINITY
    const inputForward = active ? Number(!!input.forward) - Number(!!input.backward) : 0
    const inputRight = active ? Number(!!input.right) - Number(!!input.left) : 0
    const inputUp = active ? Number(!!input.jump) - Number(!!input.crouch) : 0
    // Flight speed is constant: it starts and stops with the keys, without acceleration or deceleration.
    this.velocity.set(0, 0, 0)
    if (inputForward !== 0 || inputRight !== 0 || inputUp !== 0) {
      this.forward.set(0, 0, -1).applyQuaternion(rotation)
      this.right.set(1, 0, 0).applyQuaternion(rotation)
      this.velocity.addScaledVector(this.forward, inputForward).addScaledVector(this.right, inputRight).addScaledVector(up, inputUp).normalize()
      // Sprinting flies at twice the sprint speed, since open air has no obstacles to steer around.
      this.velocity.multiplyScalar(Math.max(o.speed * (input.sprint ? o.sprintFactor * 2 : 1), 0))
    }
    this.movement.copy(this.velocity).multiplyScalar(dt)
    this.physicalVelocity.copy(this.movement).divideScalar(delta)
    const translation = this.body.translation()
    this.body.setNextKinematicTranslation({
      x: translation.x + this.movement.x,
      y: translation.y + this.movement.y,
      z: translation.z + this.movement.z,
    })
  }

  private land() {
    this.isFlying = false
    this.collider.setEnabled(true)
    // The disabled collider may not have followed the body; force updateShape to place it at the feet again.
    this.shapeHeight = 0
    this.updateShape()
    this.velocity.y = 0
    this.verticalVelocity = 0
    this.jumping = false
    this.airborneTime = 0
    this.lastGroundedAt = Number.NEGATIVE_INFINITY
  }

  private pushDynamicBodies(dt: number) {
    const o = this.options
    const characterMass = o.characterMass ?? this.body.mass()
    const maxImpulse = Math.max(o.maxPushForce, 0) * dt
    if (characterMass <= 0 || maxImpulse <= 0) {
      return
    }
    const pushed = new Set<number>
    for (let index = 0; index < this.controller.numComputedCollisions(); index++) {
      const collision = this.controller.computedCollision(index)
      const body = collision?.collider?.parent()
      if (!collision || !body?.isDynamic() || pushed.has(body.handle)) {
        continue
      }
      pushed.add(body.handle)
      const bodyMass = body.mass()
      // normal1 points out of the obstacle, towards the character.
      this.push.set(-collision.normal1.x, -collision.normal1.y, -collision.normal1.z)
      const velocity = body.velocityAtPoint(collision.witness1)
      const closingSpeed = this.movement.dot(this.push) / dt - this.push.x * velocity.x - this.push.y * velocity.y - this.push.z * velocity.z
      if (bodyMass <= 0 || closingSpeed <= 0) {
        continue
      }
      const impulse = Math.min(closingSpeed * characterMass * bodyMass / (characterMass + bodyMass), maxImpulse)
      body.applyImpulseAtPoint({
        x: this.push.x * impulse,
        y: this.push.y * impulse,
        z: this.push.z * impulse,
      }, collision.witness1, true)
    }
  }

  private takeOff() {
    if (this.isFlying) {
      return
    }
    this.isFlying = true
    this.collider.setEnabled(false)
    this.velocity.y = this.verticalVelocity
    this.verticalVelocity = 0
    this.isGrounded = false
  }

  private updateShape() {
    const height = this.isCrouching ? this.crouchingHeight : this.standingHeight
    if (this.shapeHeight === height && this.shapeRadius === this.radius) {
      return
    }
    const {Capsule} = this.rapier
    this.collider.setShape(new Capsule(getCapsuleHalfHeight(height, this.radius), this.radius))
    this.collider.setTranslationWrtParent({
      x: 0,
      y: height / 2,
      z: 0,
    })
    // Shape casts in this same substep must use the new center, not the previous height.
    const feet = this.body.translation()
    this.collider.setTranslation({
      x: feet.x,
      y: feet.y + height / 2,
      z: feet.z,
    })
    this.shapeHeight = height
    this.shapeRadius = this.radius
  }
}
