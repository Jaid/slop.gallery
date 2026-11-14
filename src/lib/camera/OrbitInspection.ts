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
  /** the distance the orbit keeps by the direction from the center, a unit vector, in place of {@link distance}: the camera holds it for wherever it is right now as it turns, times however much closer or farther W and S moved it, like the distance something that isn’t round fits the view from on each side */
  distanceToward?: (direction: Vector3) => number
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
  /** how far the orbit turns left or right of where it started, in radians; no limit unless set */
  yawLimit?: number
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
  /** a direction from the center the distance is asked for */
  private readonly heading = new Vector3
  /** the seconds since the last input that turned the orbit */
  private idle = Infinity
  private readonly lookRotation = new Quaternion
  private readonly matrix = new Matrix4
  private readonly offset = new Vector3
  private orbiting = false
  private phi: number
  private readonly pivot: Vector3
  private readonly sphere = new Spherical
  private readonly startPhi: number

  private readonly startTheta: number
  private readonly targetRotation = new Quaternion
  private theta: number
  /** how much closer or farther than {@link OrbitSettings.distanceToward} tells the camera is right now, as a factor that eases to the one the player chose */
  private zoom = 1

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

  /** Turns the orbit by the player’s input, which holds off its circling on its own for a while. */
  addInput(yaw: number, pitch: number) {
    if (this.returning || !Number.isFinite(yaw) || !Number.isFinite(pitch)) {
      return
    }
    if (yaw || pitch) {
      this.idle = 0
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
    this.returning = true
  }

  restore() {
    this.camera.position.copy(this.originalPosition)
    this.camera.quaternion.copy(this.originalRotation)
    this.camera.fov = this.originalFov
    this.camera.updateProjectionMatrix()
  }

  /** Jumps to where the camera is headed instead of easing there, like at the start of an orbit that nothing flies into. */
  settle(center: Vector3) {
    this.approach(center, 1)
  }

  update(center: Vector3, delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return false
    }
    const {autoRotation} = this.settings
    if (autoRotation && !this.returning) {
      this.idle += delta
      if (this.idle >= autoRotation.delay) {
        this.turn(autoRotation.speed * Math.min(delta, 0.1), 0)
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
        // From however far the camera is right now.
        this.zoom = this.sphere.radius / this.getDistanceToward(this.sphere.phi, this.sphere.theta)
      }
      // How far the view is turned away from the Knot, measured before this frame’s move.
      // Only this residual eases out; orbiting itself must never pull the Knot off-center.
      this.aimOffset.copy(this.lookAt(this.pivot)).invert().multiply(this.camera.quaternion).slerp(identity, blend)
      this.pivot.copy(center)
      // Smooth on the sphere around the Knot rather than in world space, so fast orbits
      // follow the arc instead of cutting a chord toward (or through) the object.
      const [min, max] = this.getDistanceFactors()
      const factor = clamp(this.distanceFactor, min, max)
      const distance = this.getBaseDistance() * factor
      const floorLimit = Math.acos(clamp(((this.settings.floorY ?? -Infinity) + 0.18 - center.y) / distance, -1, 1))
      const ceilingLimit = Math.acos(clamp(((this.settings.ceilingY ?? Infinity) - 0.18 - center.y) / distance, -1, 1))
      this.sphere.theta = lerp(this.sphere.theta, this.theta, blend)
      this.sphere.phi = lerp(this.sphere.phi, clamp(this.phi, ceilingLimit, floorLimit), blend)
      if (this.settings.distanceToward) {
        // Only how much closer or farther the player went eases; the distance itself holds for wherever the camera is on its way.
        this.zoom = lerp(this.zoom, factor, blend)
        this.sphere.radius = this.getDistanceToward(this.sphere.phi, this.sphere.theta) * this.zoom
      } else {
        this.sphere.radius = lerp(this.sphere.radius, distance, blend)
      }
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

  private getBaseDistance() {
    const {distance, distanceToward} = this.settings
    if (distanceToward) {
      // Where the orbit is headed for.
      return this.getDistanceToward(this.phi, this.theta)
    }
    if (distance) {
      return distance
    }
    const vertical = degreesToRadians(inspectionFov)
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect)
    return this.radius / Math.sin(Math.min(vertical, horizontal) / 2) * 0.96
  }

  /** the distance limits as fractions of the default distance */
  private getDistanceFactors() {
    const base = this.getBaseDistance()
    const min = this.settings.minDistance === undefined ? minDistanceFactor : this.settings.minDistance / base
    const max = this.settings.maxDistance === undefined ? maxDistanceFactor : this.settings.maxDistance / base
    return [Math.min(min, 1), Math.max(max, 1)] as const
  }

  /** What {@link OrbitSettings.distanceToward} tells for the direction of the angles, or 1 without it. */
  private getDistanceToward(phi: number, theta: number) {
    return this.settings.distanceToward?.(this.heading.setFromSphericalCoords(1, phi, theta)) ?? 1
  }

  private lookAt(center: Vector3) {
    return this.lookRotation.setFromRotationMatrix(this.matrix.lookAt(this.camera.position, center, up))
  }
  private turn(yaw: number, pitch: number) {
    const {yawLimit = Infinity, pitchLimit = Infinity} = this.settings
    // Limited turns are measured from the start, so a large input can’t wrap around past the limit. The target only moves by
    // the clamped change; resetting it to the start’s angle could put it a full turn away from the camera, which would spin.
    const offset = deltaAngle(this.startTheta, this.theta)
    this.theta += Number.isFinite(yawLimit) ? clamp(offset + yaw, -yawLimit, yawLimit) - offset : yaw
    this.phi = clamp(this.phi - pitch, Math.max(0.05, this.startPhi - pitchLimit), Math.min(Math.PI - 0.05, this.startPhi + pitchLimit))
  }
}
