import type World from '#src/worlds/base/World.ts'
import type {PlayerPose} from './types.ts'

import {defaultEgoOptions} from 'ego-player/motor'
import {wrapAngle} from 'math'

import currentWorld from '#src/worlds/current.ts'

const copy = (pose: PlayerPose): PlayerPose => ({
  position: [...pose.position],
  yaw: pose.yaw,
  pitch: pose.pitch,
})

/** A copy of the pose with its yaw wrapped, if its numbers are finite, it looks no further than straight up or down and it stands inside the world, or, `flying`, its eyes are, below which the feet may hang out of it, or else null. */
export function validatePlayerPose({position, yaw, pitch}: PlayerPose, within: Pick<World, 'contains'> = currentWorld, flying = false): PlayerPose | null {
  if (![...position, yaw, pitch].every(Number.isFinite) || Math.abs(pitch) > Math.PI / 2 || !within.contains(flying ? [position[0], position[1] + defaultEgoOptions.eyeHeight, position[2]] : position)) {
    return null
  }
  return {
    position: [...position],
    yaw: wrapAngle(yaw),
    pitch,
  }
}

/** Live movement stays outside React. */
export default class PlayerSession {
  private pose: PlayerPose

  /** Keeps a player’s pose in the world, starting at its spawn. */
  constructor(private readonly world: Pick<World, 'contains' | 'spawn'>) {
    this.pose = copy(world.spawn)
  }

  capture(value: PlayerPose, flying = false) {
    const pose = validatePlayerPose(value, this.world, flying)
    if (pose) {
      this.pose = pose
    }
  }

  restore(value: PlayerPose, flying = false) {
    this.pose = validatePlayerPose(value, this.world, flying) ?? copy(this.world.spawn)
  }

  snapshot() {
    return copy(this.pose)
  }
}

/** the player’s session in the current world */
export const playerSession = new PlayerSession(currentWorld)
