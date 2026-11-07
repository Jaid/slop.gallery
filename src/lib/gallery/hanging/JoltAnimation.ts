import type {HangingPose, HangingStage} from './base/HangingAnimation.ts'

import {Quaternion, Vector3} from 'three/webgpu'

import HangingAnimation from './base/HangingAnimation.ts'
import {heft, place, turn, wobble} from './motion.ts'
import {slapShake} from './SlapAnimation.ts'

const rotation = new Quaternion
const offset = new Vector3
const hook = new Vector3

/**
 * A work already hanging, jolted on its hook by a blow `delay` seconds in that runs through its wall from a work slapped onto it nearby, toward the side the stage’s `from` lies on: it hops off the wall a little and its bottom swings away from the blow.
 * At a `strength` of 1, it shakes half as much as the slap shakes a work of 1.2 m square; big works shake less and slower, small ones more and quicker, as they do when slapped.
 */
export default class JoltAnimation extends HangingAnimation {
  readonly duration: number
  readonly impact: number
  override readonly jolt: number

  constructor(delay: number, private readonly strength: number) {
    super()
    this.impact = delay
    this.duration = delay + 1.6
    this.jolt = 0.5 * strength
  }

  dust() {
    return []
  }

  protected move(time: number, stage: HangingStage, target: HangingPose) {
    const t = time - this.impact
    if (t <= 0) {
      return
    }
    const mass = heft(stage)
    const slow = mass ** 0.25
    const share = 0.5 * this.strength
    const bounce = slapShake.bounce * share / mass ** 0.4
    place(target, {
      offset: offset.set(0, 0.3 * bounce * Math.abs(wobble(t, 30 / slow, 11)), bounce * Math.max(0, wobble(t, 34 / slow, 12))),
      pivot: hook.set(0, stage.halfHeight * 0.8, stage.back),
      rotation: turn('z', -stage.side * slapShake.rock * share / slow * wobble(t, 15 / slow, 4.5), rotation),
    })
  }
}
