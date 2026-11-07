import type {HangingPose, HangingStage} from './base/HangingAnimation.ts'

import {clamp} from 'math'
import {Euler, Quaternion, Vector3} from 'three/webgpu'

/** no rotation at all, the work as it hangs; never written to */
export const rest: Readonly<Quaternion> = new Quaternion

const pivotOffset = new Vector3
const scaled = new Vector3
const turned = new Quaternion
const euler = new Euler
const corner = new Vector3

/** A swing at `omega` radians per second that dies away at `decay` per second, starting at 0 and moving up. */
export const wobble = (time: number, omega: number, decay: number) => Math.exp(-decay * time) * Math.sin(omega * time)

/** A swing at `omega` radians per second that dies away at `decay` per second, starting at its peak. */
export const ringing = (time: number, omega: number, decay: number) => Math.exp(-decay * time) * Math.cos(omega * time)

/** How heavy a frame of `halfWidth` × `halfHeight` is against one of 1.2 m square, by its area, from 0.35 to 3. */
export const heft = ({halfHeight, halfWidth}: {
  halfHeight: number
  halfWidth: number
}) => clamp(4 * halfWidth * halfHeight / 1.44, 0.35, 3)

/** A uniformly random value between `from` and `to`. */
export const between = (random: () => number, from: number, to: number) => from + random() * (to - from)

/**
 * Sets `target` to the work rotated by `rotation` around `pivot`, scaled by `scale` around `scalePivot` beforehand and moved by `offset` afterward, all in the work’s frame.
 * A point `x` of the work ends up at `pivot + rotation · (scalePivot + scale · (x − scalePivot) − pivot) + offset`.
 */
export function place(target: HangingPose, {offset, rotation, pivot, scale, scalePivot}: {
  offset?: Vector3
  pivot?: Vector3
  rotation?: Quaternion
  scale?: Vector3
  scalePivot?: Vector3
}) {
  target.quaternion.copy(rotation ?? turned.identity())
  target.scale.copy(scale ?? scaled.set(1, 1, 1))
  // scalePivot − scale · scalePivot − pivot, turned, plus pivot and the offset
  pivotOffset.set(0, 0, 0)
  if (scalePivot) {
    pivotOffset.copy(scalePivot).sub(scaled.copy(scalePivot).multiply(target.scale))
  }
  if (pivot) {
    pivotOffset.sub(pivot)
  }
  target.position.copy(pivotOffset.applyQuaternion(target.quaternion))
  if (pivot) {
    target.position.add(pivot)
  }
  if (offset) {
    target.position.add(offset)
  }
}

/** Pushes the posed frame straight out of its wall wherever it would reach into it. */
export function keepOffWall(stage: HangingStage, target: HangingPose) {
  let lowest = Infinity
  for (const x of [-stage.halfWidth, stage.halfWidth]) {
    for (const y of [-stage.halfHeight, stage.halfHeight]) {
      for (const z of [stage.back, stage.front]) {
        lowest = Math.min(lowest, corner.set(x, y, z).multiply(target.scale).applyQuaternion(target.quaternion).z)
      }
    }
  }
  const into = stage.back - (target.position.z + lowest)
  if (into > 0) {
    target.position.z += into
  }
}

/** The work turned toward the player at its start, tilted a little, as they hold it out, then rolled by `roll` radians. Close to the wall, it is turned less, so it stays clear of the wall. */
export function heldOrientation(stage: HangingStage, roll: number, target = new Quaternion) {
  const {back, from} = stage
  const yaw = Math.atan2(from.x, from.z) * 0.7
  const pitch = -Math.atan2(from.y, Math.hypot(from.x, from.z)) * 0.5
  for (let share = 1; share > 0.02; share *= 0.8) {
    target.setFromEuler(euler.set(pitch * share, yaw * share, roll, 'YXZ'))
    if (from.z + lowestReach(stage, target) >= back + 0.01) {
      return target
    }
  }
  return target.setFromEuler(euler.set(0, 0, roll))
}

/** Rotation by `angle` radians around the axis. */
export function turn(axis: 'x' | 'y' | 'z', angle: number, target = new Quaternion) {
  return target.setFromEuler(euler.set(axis === 'x' ? angle : 0, axis === 'y' ? angle : 0, axis === 'z' ? angle : 0))
}

/** The lowest point the frame reaches toward its wall turned by `rotation` around its middle, relative to its middle. */
function lowestReach({back, front, halfHeight, halfWidth}: HangingStage, rotation: Quaternion) {
  let lowest = Infinity
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      for (const z of [back, front]) {
        lowest = Math.min(lowest, corner.set(x, y, z).applyQuaternion(rotation).z)
      }
    }
  }
  return lowest
}
