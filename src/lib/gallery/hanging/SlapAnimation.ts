import type {HangingPose, HangingStage} from './base/HangingAnimation.ts'

import {Quaternion, Vector3} from 'three/webgpu'

import HangingAnimation from './base/HangingAnimation.ts'
import {motes, outlineBurst} from './dust.ts'
import {heft, heldOrientation, place, rest, ringing, turn, wobble} from './motion.ts'

/** seconds the work is drawn back toward the player before it flies */
const windup = 0.08
/** seconds the work flies from the player’s hands to the wall */
const flight = 0.1
/** seconds the work stays squashed flat against the wall before it springs back, a hit-stop */
const hold = 0.05
/** how far a work of 1.2 m square bounces off its wall and how fast, and how far it rocks on its hook and how fast, in radians */
export const slapShake = {
  bounce: 0.025,
  bounceOmega: 26,
  rock: 0.05,
  rockOmega: 13,
}
/** the roll it is held at as it leaves the player’s hands */
const heldRoll = 0.28
/** how much further it is cocked at the height of its wind-up */
const cockedRoll = 0.12
const start = new Quaternion
const rotation = new Quaternion
const offset = new Vector3
const scale = new Vector3
const hook = new Vector3
const wall = new Vector3
const smooth = (u: number) => u * u * (3 - 2 * u)

/**
 * The work is drawn back and cocked, then slapped flat onto the wall straight from the player’s hands, stays squashed against it for a moment, bounces off a little and rocks on its hook, blowing a ring of dust out from under its frame.
 * Big works squash less, bounce off less and rock slower, like a pendulum of their length, small ones snap back and chatter quickly.
 */
export default class SlapAnimation extends HangingAnimation {
  readonly impact = windup + flight
  readonly duration = this.impact + hold + 1.6
  override readonly jolt = 0.8

  dust(stage: HangingStage) {
    return [
      ...outlineBurst(stage, {
        count: 130,
        delay: this.impact,
        speed: 1.9,
      }),
      ...motes(stage, {
        count: 36,
        delay: this.impact,
        origin: point => [point.x, point.y, stage.back + 0.03],
      }),
    ]
  }

  protected move(time: number, stage: HangingStage, target: HangingPose) {
    if (time < windup) {
      // Drawn back toward the player, up and cocked a little further, easing in and out of it.
      const w = smooth(time / windup)
      heldOrientation(stage, stage.side * (heldRoll + cockedRoll * w), rotation)
      offset.copy(stage.from).multiplyScalar(1 + 0.1 * w)
      offset.y += 0.035 * w
      place(target, {
        offset,
        rotation,
      })
      return
    }
    if (time < this.impact) {
      const u = (time - windup) / flight
      // It speeds up into the slap and lies flat just before it lands.
      rotation.slerpQuaternions(heldOrientation(stage, stage.side * (heldRoll + cockedRoll), start), rest, Math.min(1, u ** 1.4 * 1.2))
      offset.copy(stage.from).multiplyScalar(1.1 * (1 - u * u))
      offset.y += 0.035 * (1 - u * u) + Math.sin(Math.PI * u) * 0.08
      place(target, {
        offset,
        rotation,
      })
      return
    }
    // It hangs squashed flat until the hit-stop ends.
    const t = Math.max(0, time - this.impact - hold)
    // A pendulum swings slower by the square root of its length, which grows by the square root of the area.
    const mass = heft(stage)
    const slow = mass ** 0.25
    const squashed = ringing(t, 42 / slow, 16)
    const spread = 0.06 / slow
    const squash = 0.4 / slow
    place(target, {
      // It bounces off the wall and back.
      offset: offset.set(0, 0, slapShake.bounce / mass ** 0.4 * Math.max(0, wobble(t, slapShake.bounceOmega / slow, 9))),
      pivot: hook.set(0, stage.halfHeight * 0.8, stage.back),
      rotation: turn('z', -stage.side * slapShake.rock / slow * wobble(t, slapShake.rockOmega / slow, 3.6), rotation),
      scale: scale.set(1 + spread * squashed, 1 + spread * squashed, 1 - squash * squashed),
      scalePivot: wall.set(0, 0, stage.back),
    })
  }
}
