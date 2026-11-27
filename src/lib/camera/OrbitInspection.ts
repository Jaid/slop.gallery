import type {PerspectiveCamera} from 'three/webgpu'

import {clamp, degreesToRadians, deltaAngle, lerp} from 'math'
import {Matrix4, Quaternion, Spherical, Vector3} from 'three/webgpu'

const up = new Vector3(0, 1, 0)
const identity = new Quaternion
export const inspectionFov = 50
/** how far an orbit turns per pixel the pointer moves, in radians, before the player’s pointer speed */
export const orbitPointerSpeed = 0.0015
/** how fast A and D circle an orbit, in radians per second, before the player’s pointer speed */
export const orbitKeySpeed = 1.5
const minDistanceFactor = 0.5
const maxDistanceFactor = 1.75

/** How the camera orbits one object. Distances are measured from the orbit’s center, in meters. */
export type OrbitSettings = {
  /** how the orbit circles on its own while left alone, like behind the intro’s menu; never unless set */
  autoRotation?: {
    /** the seconds after the last input before it circles on its own again; it circles from the start */
    delay: number
    /** in radians per second, positive turning the way the pointer moving right does */
    speed: number
  }
  /** how strongly the background blurs, relative to the default lens; 0 keeps it sharp */
  blur?: number
  /** the height the camera stays 18 cm below; no limit unless set */
  ceilingY?: number
  /** where the orbit starts, framing the radius by default */
  distance?: number
  /** the direction from the center the orbit starts in, instead of wherever the camera is */
  facing?: [number, number, number]
  /** the height the camera stays 18 cm above; no limit unless set */
  floorY?: number
  /** the field of view while orbiting, {@link inspectionFov} unless set */
  fov?: number
  /** how far from the center the camera stays at least while it orbits in the direction from the center, a unit vector, like outside of a box around the object, which it holds at once instead of easing there; nothing but the distance limits unless set */
  keepOut?: (direction: Vector3) => number
  /** the farthest S gets, 1.75 times the default distance unless set */
  maxDistance?: number
  /** the closest W gets, half the default distance unless set */
  minDistance?: number
  /** how far the orbit tilts up or down from where it started, in radians; no limit unless set */
  pitchLimit?: number
  /** radius of the sphere the default distance frames at the inspection field of view */
  radius: number
  /** how the orbit rocks while {@link OrbitInspection.rock} asks it to, swaying left and right against nodding up and down, two sways to three nods; it can’t rock unless set */
  rocking?: OrbitRocking
  /** how far the orbit turns left or right of where it started, in radians; no limit unless set */
  yawLimit?: number
}

/** An orbit’s rock: it sways and nods around the pose the player left it in, within the orbit’s limits. Stopping it, or the player turning the orbit, puts the rock’s turn into that pose, from which it sets off along its figure anew. */
export type OrbitRocking = {
  /** how far it nods up and down at most, in radians */
  nod: number
  /** how fast it goes through its figure at speed 1, in radians a second, so a sway either way and back takes π divided by it */
  pace: number
  /** how far it sways left and right at most, in radians */
  sway: number
}

/** one axis of a rock fitted into the orbit’s limits: it swings by `amplitude` either way around `center`, starting `start` along its sine, all in radians */
type RockAxis = {
  amplitude: number
  center: number
  start: number
}

/** A rock’s axis swinging by `amplitude` either way between turns of `low` and `high` from where it sets off, at 0 along its sine there, heading toward its middle. */
function fitRockAxis(amplitude: number, low: number, high: number): RockAxis {
  // A pose already past a limit, which the orbit holds at the limit anyway, counts as right at it.
  const lowest = Math.min(low, 0)
  const highest = Math.max(high, 0)
  const reach = Math.min(amplitude, (highest - lowest) / 2)
  if (!(reach > 0)) {
    return {
      amplitude: 0,
      center: 0,
      start: 0,
    }
  }
  const center = clamp(0, lowest + reach, highest - reach)
  const share = clamp(-center / reach, -1, 1)
  return {
    amplitude: reach,
    center,
    start: share > 0 ? Math.PI - Math.asin(share) : Math.asin(share),
  }
}

/**
 * A temporary camera owner; orbiting never changes the player’s physical pose.
 * It reads its settings anew whenever it moves the camera, so whoever handed them over may change them meanwhile, like the distances of a view that changes its shape; only the radius and where it starts are taken once.
 */
export default class OrbitInspection {
  readonly originalFov: number
  readonly originalPosition: Vector3
  readonly originalRotation: Quaternion
  readonly radius: number
  returning = false
  private readonly aimOffset = new Quaternion
  private readonly destination = new Spherical
  private distanceFactor = 1
  /** the seconds since the last input that turned the orbit */
  private idle = Infinity
  private readonly lookRotation = new Quaternion
  private readonly matrix = new Matrix4
  private readonly offset = new Vector3
  private orbiting = false
  private phi: number
  private readonly pivot: Vector3
  /** how far the rock has turned the orbit from {@link theta} and {@link phi} and where it is along its figure, in radians, how fast it goes, 0 while it stands still, and its figure fitted into the limits from where it set off */
  private readonly rocked: {
    fit: {
      pitch: RockAxis
      yaw: RockAxis
    } | null
    phase: number
    pitch: number
    speed: number
    yaw: number
  } = {
    fit: null,
    phase: 0,
    pitch: 0,
    speed: 0,
    yaw: 0,
  }
  private readonly sphere = new Spherical
  private readonly startPhi: number

  private readonly startTheta: number
  private readonly targetRotation = new Quaternion
  private theta: number

  constructor(readonly camera: PerspectiveCamera, center: Vector3, private readonly settings: OrbitSettings) {
    const {radius, distance, minDistance, maxDistance} = settings
    if (!(radius > 0) || !Number.isFinite(radius)) {
      throw new Error('Inspection radius must be positive.')
    }
    for (const value of [distance, minDistance, maxDistance]) {
      if (value !== undefined && !(value > 0 && Number.isFinite(value))) {
        throw new Error('Inspection distances must be positive.')
      }
    }
    this.radius = radius
    this.originalPosition = camera.position.clone()
    this.originalRotation = camera.quaternion.clone()
    this.originalFov = camera.fov
    this.pivot = center.clone()
    this.sphere.setFromVector3(camera.position.clone().sub(center))
    const start = settings.facing ? new Spherical : this.sphere
    if (settings.facing) {
      start.setFromVector3(new Vector3(...settings.facing))
    }
    this.startTheta = start.theta
    this.startPhi = start.phi
    this.theta = start.theta
    this.phi = start.phi
  }

  /** Turns the orbit by the player’s input, which holds off its circling on its own for a while and puts the rock’s turn into the pose it turns from. */
  addInput(yaw: number, pitch: number) {
    if (this.returning || !Number.isFinite(yaw) || !Number.isFinite(pitch)) {
      return
    }
    if (yaw || pitch) {
      this.idle = 0
      this.settleRock()
    }
    this.turn(yaw, pitch)
  }

  adjustDistance(amount: number) {
    if (this.returning || !Number.isFinite(amount)) {
      return
    }
    const [min, max] = this.getDistanceFactors()
    this.distanceFactor = clamp(this.distanceFactor + amount, min, max)
  }

  getProximity(center: Vector3) {
    const [min, max] = this.getDistanceFactors()
    const distanceFactor = this.camera.position.distanceTo(center) / this.getBaseDistance()
    return 1 - clamp((distanceFactor - min) / (max - min), 0, 1)
  }

  release() {
    this.rock(0)
    this.returning = true
  }

  restore() {
    this.camera.position.copy(this.originalPosition)
    this.camera.quaternion.copy(this.originalRotation)
    this.camera.fov = this.originalFov
    this.camera.updateProjectionMatrix()
  }

  /** Rocks the orbit at `speed`, 1 for its own pace, keeping its place along the figure when the speed changes, or stops it at 0, leaving the camera where the rock turned it. An orbit without {@link OrbitSettings.rocking} never rocks. */
  rock(speed: number) {
    if (!this.settings.rocking || this.returning || !Number.isFinite(speed)) {
      return
    }
    if (speed <= 0) {
      this.settleRock()
    }
    this.rocked.speed = Math.max(speed, 0)
  }

  /** Jumps to where the camera is headed instead of easing there, like at the start of an orbit that nothing flies into. */
  settle(center: Vector3) {
    this.approach(center, 1)
  }

  update(center: Vector3, delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return false
    }
    const {autoRotation, rocking} = this.settings
    if (!this.returning) {
      this.idle += delta
      if (autoRotation && this.idle >= autoRotation.delay) {
        this.turn(autoRotation.speed * Math.min(delta, 0.1), 0)
      }
      const {rocked} = this
      if (rocking && rocked.speed) {
        // Set off near a limit, the figure moves over so it just reaches it, instead of running into it and waiting there.
        rocked.fit ??= this.fitRock(rocking, center)
        const {fit} = rocked
        rocked.phase += Math.min(delta, 0.06) * rocking.pace * rocked.speed
        rocked.yaw = fit.yaw.center + Math.sin(2 * rocked.phase + fit.yaw.start) * fit.yaw.amplitude
        rocked.pitch = fit.pitch.center + Math.sin(3 * rocked.phase + fit.pitch.start) * fit.pitch.amplitude
      }
    }
    return this.approach(center, 1 - Math.exp(-Math.min(delta, 0.06) * 10))
  }

  /** Moves the camera the share `blend` of the way to where it is headed, 1 for all of it, and tells whether a return has arrived. */
  private approach(center: Vector3, blend: number) {
    const fov = this.returning ? this.originalFov : this.settings.fov ?? inspectionFov
    if (this.returning) {
      this.orbiting = false
      // Return around the object, not straight through it after a half orbit.
      this.sphere.setFromVector3(this.offset.copy(this.camera.position).sub(this.pivot))
      this.destination.setFromVector3(this.offset.copy(this.originalPosition).sub(this.pivot))
      const angle = deltaAngle(this.sphere.theta, this.destination.theta)
      this.sphere.theta += angle * blend
      this.sphere.phi = lerp(this.sphere.phi, this.destination.phi, blend)
      this.sphere.radius = lerp(this.sphere.radius, this.destination.radius, blend)
      this.camera.position.copy(this.pivot).add(this.offset.setFromSpherical(this.sphere))
      this.targetRotation.copy(this.originalRotation)
      this.camera.quaternion.slerp(this.targetRotation, blend)
    } else {
      if (!this.orbiting) {
        // (Re)enter from wherever the camera currently is, e.g. after an interrupted return.
        this.orbiting = true
        this.sphere.setFromVector3(this.offset.copy(this.camera.position).sub(this.pivot))
        this.theta = this.sphere.theta + deltaAngle(this.sphere.theta, this.theta)
      }
      // How far the view is turned away from the Knot, measured before this frame’s move.
      // Only this residual eases out; orbiting itself must never pull the Knot off-center.
      this.aimOffset.copy(this.lookAt(this.pivot)).invert().multiply(this.camera.quaternion).slerp(identity, blend)
      this.pivot.copy(center)
      // Smooth on the sphere around the Knot rather than in world space, so fast orbits
      // follow the arc instead of cutting a chord toward (or through) the object.
      const distance = this.getDistance()
      const floorLimit = Math.acos(clamp(((this.settings.floorY ?? -Infinity) + 0.18 - center.y) / distance, -1, 1))
      const ceilingLimit = Math.acos(clamp(((this.settings.ceilingY ?? Infinity) - 0.18 - center.y) / distance, -1, 1))
      const {theta, phi} = this.turned(this.rocked.yaw, this.rocked.pitch)
      this.sphere.theta = lerp(this.sphere.theta, theta, blend)
      this.sphere.phi = lerp(this.sphere.phi, clamp(phi, ceilingLimit, floorLimit), blend)
      this.sphere.radius = lerp(this.sphere.radius, distance, blend)
      const {keepOut} = this.settings
      if (keepOut) {
        this.sphere.radius = Math.max(this.sphere.radius, keepOut(this.offset.setFromSphericalCoords(1, this.sphere.phi, this.sphere.theta)))
      }
      this.camera.position.copy(center).add(this.offset.setFromSpherical(this.sphere))
      this.camera.quaternion.copy(this.lookAt(center)).multiply(this.aimOffset)
    }
    this.camera.fov = lerp(this.camera.fov, fov, blend)
    this.camera.updateProjectionMatrix()
    if (this.returning && this.camera.position.distanceTo(this.originalPosition) < 0.001 && this.camera.quaternion.angleTo(this.originalRotation) < 0.001 && Math.abs(this.camera.fov - this.originalFov) < 0.001) {
      this.restore()
      return true
    }
    return false
  }

  /** the rock’s figure from the pose it sets off from, each axis as wide as it is made where the limits leave room for it, moved over to end right at a limit it would run past, and narrowed to the room between them where they leave less */
  private fitRock({nod, sway}: OrbitRocking, center: Vector3): {
    pitch: RockAxis
    yaw: RockAxis
  } {
    const {yawLimit = Infinity, pitchLimit = Infinity, floorY = -Infinity, ceilingY = Infinity} = this.settings
    const turned = deltaAngle(this.startTheta, this.theta)
    const distance = this.getDistance()
    // A rock’s pitch lowers phi, so its room up is down to the least phi and its room down up to the greatest.
    const leastPhi = Math.max(0.05, this.startPhi - pitchLimit, Math.acos(clamp((ceilingY - 0.18 - center.y) / distance, -1, 1)))
    const greatestPhi = Math.min(Math.PI - 0.05, this.startPhi + pitchLimit, Math.acos(clamp((floorY + 0.18 - center.y) / distance, -1, 1)))
    return {
      pitch: fitRockAxis(nod, this.phi - greatestPhi, this.phi - leastPhi),
      yaw: fitRockAxis(sway, -yawLimit - turned, yawLimit - turned),
    }
  }

  private getBaseDistance() {
    const {distance} = this.settings
    if (distance) {
      return distance
    }
    const vertical = degreesToRadians(inspectionFov)
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect)
    return this.radius / Math.sin(Math.min(vertical, horizontal) / 2) * 0.96
  }

  /** how far from the center the camera heads */
  private getDistance() {
    const [min, max] = this.getDistanceFactors()
    return this.getBaseDistance() * clamp(this.distanceFactor, min, max)
  }

  /** the distance limits as fractions of the default distance */
  private getDistanceFactors() {
    const base = this.getBaseDistance()
    const min = this.settings.minDistance === undefined ? minDistanceFactor : this.settings.minDistance / base
    const max = this.settings.maxDistance === undefined ? maxDistanceFactor : this.settings.maxDistance / base
    return [Math.min(min, 1), Math.max(max, 1)] as const
  }
  private lookAt(center: Vector3) {
    return this.lookRotation.setFromRotationMatrix(this.matrix.lookAt(this.camera.position, center, up))
  }
  /** Puts the rock’s turn into the orbit, from where it sets off along its figure anew. */
  private settleRock() {
    const {rocked} = this
    if (rocked.yaw || rocked.pitch) {
      this.turn(rocked.yaw, rocked.pitch)
    }
    rocked.fit = null
    rocked.phase = 0
    rocked.pitch = 0
    rocked.yaw = 0
  }
  private turn(yaw: number, pitch: number) {
    const {theta, phi} = this.turned(yaw, pitch)
    this.theta = theta
    this.phi = phi
  }
  /** where the orbit heads when turned by `yaw` and `pitch`, within its limits */
  private turned(yaw: number, pitch: number) {
    const {yawLimit = Infinity, pitchLimit = Infinity} = this.settings
    // Limited turns are measured from the start, so a large input can’t wrap around past the limit. The target only moves by
    // the clamped change; resetting it to the start’s angle could put it a full turn away from the camera, which would spin.
    const offset = deltaAngle(this.startTheta, this.theta)
    return {
      theta: this.theta + (Number.isFinite(yawLimit) ? clamp(offset + yaw, -yawLimit, yawLimit) - offset : yaw),
      phi: clamp(this.phi - pitch, Math.max(0.05, this.startPhi - pitchLimit), Math.min(Math.PI - 0.05, this.startPhi + pitchLimit)),
    }
  }
}
