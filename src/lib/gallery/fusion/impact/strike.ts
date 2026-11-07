import type {Vec3} from '../../types.ts'
import type {FusionImpact} from '../Fusion.ts'
import type {RapierRigidBody} from '@react-three/rapier'
import type {Object3D} from 'three/webgpu'

import {clamp} from 'math'
import {Vector3} from 'three/webgpu'

import {impactSounds} from '../../../audio/impactSounds.ts'

const local = new Vector3

/** How the thrown `body` struck a hung portrait as their collision began: where its middle, its center of mass, was, and the fastest it moved within the last few steps, as the solver may have bounced it already, unless it is no body whose strikes sound, which leaves how fast it moves now. */
export function impactOf(body: RapierRigidBody): FusionImpact {
  const center = body.worldCom()
  const {x, y, z} = body.linvel()
  return {
    center: [center.x, center.y, center.z],
    speed: impactSounds.recentSpeed(body) ?? Math.hypot(x, y, z),
  }
}

/** how far the ripple of an orb’s strike reaches at most, in meters, as an orb is much smaller than a portrait */
export const orbRippleRadius = 2

/** how hard a strike at `speed` m/s is, 0.55–1.2, 1 for a brisk throw */
export function impactStrength(speed: number) {
  return clamp(speed / 7, 0.55, 1.2)
}

/** Where the world’s `point` lies in the plane of the image that `work`, a work’s group, holds facing +z, in meters from the image’s middle along its width and up, as the group stands now. */
export function imagePoint(work: Object3D, point: Vec3): [number, number] {
  work.updateWorldMatrix(true, false)
  work.worldToLocal(local.fromArray(point))
  return [local.x, local.y]
}
