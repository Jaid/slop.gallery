import type HangingAnimation from './base/HangingAnimation.ts'
import type {Vec3} from 'math'

import {cameraPose} from '../actions.ts'
import {hangingAnimation} from './index.ts'

/** a work’s arrival on its wall, waiting for the work to get there */
export type HangingRequest = {
  animation: HangingAnimation
  /** where the work flies in from, in world meters */
  from: Vec3
  /** where the work hangs, in world meters */
  position: Vec3
  /** the work’s yaw where it hangs */
  rotation: number
  /** what the dust of this arrival is drawn from */
  seed: number
}

const requests = new Map<string, HangingRequest>

/** Where a work flies out of the player’s hands: a little below the middle of their view, as if held in front of the chest. */
export function holdPoint(pose: Pick<typeof cameraPose, 'direction' | 'position'> = cameraPose): Vec3 {
  const [x, y, z] = pose.position
  const [dx, dy, dz] = pose.direction
  return [x + dx * 0.9, y + dy * 0.9 - 0.22, z + dz * 0.9]
}

/** Lets the work `id`, just hung at `position` with the yaw `rotation`, arrive there flying in from `from`, by default the player’s hands, by `animation`, by default the slap. */
export function requestHanging(id: string, position: Vec3, rotation: number, from = holdPoint(), animation: HangingAnimation = hangingAnimation) {
  requests.set(id, {
    animation,
    from,
    position,
    rotation,
    seed: Math.floor(Math.random() * 2 ** 32),
  })
}

/** Lets the work `id`, hanging at `position` with the yaw `rotation`, be jolted by `animation` from a blow at `from`, unless an arrival of its own waits for it already, which the jolt mustn’t replace. */
export function requestJolt(id: string, position: Vec3, rotation: number, from: Vec3, animation: HangingAnimation) {
  if (!requests.has(id)) {
    requestHanging(id, position, rotation, from, animation)
  }
}

/** Takes the arrival waiting for the work `id`, once the work, hung at `position` with the yaw `rotation`, hangs where the arrival asked for. Until then, as when the store’s update hasn’t reached the work yet, it keeps waiting. */
export function takeHanging(id: string, position: Vec3, rotation: number) {
  const request = requests.get(id)
  if (!request) {
    return
  }
  const there = request.position.every((value, axis) => Math.abs(value - position[axis]) < 1e-6) && Math.abs(request.rotation - rotation) < 1e-6
  if (!there) {
    return
  }
  requests.delete(id)
  return request
}
