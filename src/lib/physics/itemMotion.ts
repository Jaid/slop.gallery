import type {Vec3} from '../gallery/types.ts'
import type {RigidBody} from '@dimforge/rapier3d-compat'

/** peak hand speed, in m/s, for a comfortably weighted 1.8 kg object */
export const throwSpeed = 10
const comfortableMass = 1.8
const still: Vec3 = [0, 0, 0]

export type ItemMotion = {
  mass: number
  /** speed relative to the hand, excluding inherited momentum */
  speed: number
  spin: Vec3
  throwing: boolean
  velocity: Vec3
}

/** Light objects catch little of the hand’s effort; heavy ones exhaust it. Symmetric in log-mass, with no discontinuities. */
export function handSpeed(mass: number) {
  const ratio = Math.max(0, mass) / comfortableMass
  return throwSpeed * 2 / (Math.sqrt(ratio) + 1 / Math.sqrt(ratio))
}

/** A release inherits actual player motion, not requested input speed. Rising adds loft; running into the aim adds drive without turning a sidestep into a forward boost. */
export function itemMotion(mass: number, direction: Vec3, throwing: boolean, playerVelocity: Vec3 = still): ItemMotion {
  const length = Math.hypot(...direction) || 1
  const aim = direction.map(value => value / length)
  const horizontal = Math.hypot(aim[0], aim[2])
  const forward = horizontal > 1e-6 ? Math.max(0, (playerVelocity[0] * aim[0] + playerVelocity[2] * aim[2]) / horizontal) : 0
  const rise = Math.max(0, playerVelocity[1])
  const speed = throwing ? handSpeed(mass) : 0
  // A sprint stretches the arc forward. On the way up, the hand makes a more lofted basketball-like release.
  const drive = throwing ? Math.min(forward * 0.2, 1.8) : 0
  const lift = throwing ? speed * 0.2 + Math.min(rise * 0.35, 2) : 0
  const velocity = playerVelocity.map((value, axis) => value + aim[axis] * speed + (axis === 1 ? lift : (horizontal > 1e-6 ? aim[axis] / horizontal * drive : 0))) as Vec3
  const tumble = throwing ? Math.sqrt(speed / throwSpeed) : 0
  return {
    mass,
    speed,
    throwing,
    velocity,
    spin: [3 * tumble, 2 * tumble, tumble],
  }
}

/** The released compound’s mass, including decorative colliders that are disabled while attached (e.g. a leaf’s stalk). */
export function itemMass(body: RigidBody) {
  let colliderMass = 0
  for (let i = 0; i < body.numColliders(); i++) {
    colliderMass += body.collider(i).mass()
  }
  return Math.max(body.mass(), colliderMass)
}
