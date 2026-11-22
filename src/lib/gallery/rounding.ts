import type {Vec3} from './types.ts'

import {clamp, degreesToRadians, radiansToDegrees} from 'math'
import {Euler, Quaternion} from 'three/webgpu'

import {cameraPose, flyPlayer, notify} from './actions.ts'

/** key that rounds the player’s view with `?development`, see {@link roundView} */
export const roundingKey = 'KeyR'

/** a view with whole numbers for its eyes’ position in meters and its yaw and pitch in degrees, as recipes and examples take them */
export type RoundedView = {
  /** degrees, positive looks up */
  pitch: number
  position: Vec3
  /** degrees, 0 looks toward −z, positive turns left */
  yaw: number
}

/** The whole numbers nearest to the view of eyes at `position` looking along `direction`, which needs no length of 1. */
export function roundedView(position: Vec3, direction: Vec3): RoundedView {
  const [x, y, z] = direction
  // Adding 0 turns a rounded −0 into 0.
  const round = (value: number) => Math.round(value) + 0
  return {
    position: [round(position[0]), round(position[1]), round(position[2])],
    yaw: round(radiansToDegrees(Math.atan2(-x, -z))),
    pitch: round(radiansToDegrees(Math.asin(clamp(y / Math.hypot(x, y, z), -1, 1)))),
  }
}

/** Moves the player’s eyes to the nearest whole meters and turns them to the nearest whole degrees of yaw and pitch, flying, so they stay where they are put. */
export function roundView() {
  const {pitch, position, yaw} = roundedView(cameraPose.position, cameraPose.direction)
  const rotation = new Quaternion
  flyPlayer({
    position,
    rotation: rotation.setFromEuler(new Euler(degreesToRadians(pitch), degreesToRadians(yaw), 0, 'YXZ')).toArray(),
  })
  notify(`Rounded to ${position.join(', ')}, yaw ${yaw}°, pitch ${pitch}°. F lands.`)
}
