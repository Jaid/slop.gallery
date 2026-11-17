import type {Vec3} from '../gallery/types.ts'
import type {RigidBody} from '@dimforge/rapier3d-compat'

/** Scripted ballistic shots keep their explicit speed; hand throws use `launchSpeed` instead. */
export const throwSpeed = 10

export type ItemLaunch = {
  mass: number
  spin: Vec3
  throwing: boolean
  velocity: Vec3
}

/** The colliders retain their mass even while their body is fixed, disabled or freshly detached. */
export function itemMass(body: RigidBody) {
  let mass = 0
  for (let i = 0; i < body.numColliders(); i++) {
    mass += body.collider(i).mass()
  }
  return Math.max(0.001, mass)
}

/** A hand-sized weight travels best. Light foliage loses purchase; heavy objects exhaust the arm’s impulse. Mass is in kilograms, speed in meters per second. */
export function launchSpeed(mass: number) {
  const ratio = Math.max(0.001, mass) / 0.9
  return 12 * 2 * Math.sqrt(ratio) / (1 + ratio)
}

/** Full physical momentum, not input intent: sprinting into a wall adds nothing, strafing carries sideways and a rising jump makes a lob. A drop has no arm impulse, but keeps the carrier’s momentum. */
export function itemLaunch(mass: number, direction: Readonly<Vec3>, carrier: Readonly<Vec3>, throwing: boolean): ItemLaunch {
  const speed = throwing ? launchSpeed(mass) : 0
  const length = Math.hypot(...direction) || 1
  return {
    mass,
    throwing,
    velocity: direction.map((value, axis) => carrier[axis] + value / length * speed + (axis === 1 ? speed / 6 : 0)) as Vec3,
    spin: throwing ? [3, 2, 1].map(value => value * speed / 12) as Vec3 : [0, 0, 0],
  }
}
