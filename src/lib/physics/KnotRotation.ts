import type {RigidBody} from '@dimforge/rapier3d-compat'

import {RigidBodyType} from '@dimforge/rapier3d-compat'
import {Quaternion} from 'three/webgpu'

/** seconds an exhibited Knot takes for one revolution */
export const knotRotationPeriod = 30

/** One gentle revolution every `knotRotationPeriod` seconds until an exhibited Knot is physically disturbed. All showcased Knots follow one shared clock, so they turn in sync however late each one appeared. */
export default class KnotRotation {
  private readonly bases = new WeakMap<RigidBody, Quaternion>
  private elapsed = 0
  private readonly increment = new Quaternion
  private readonly released = new WeakSet<RigidBody>
  private readonly rotation = new Quaternion

  /** moves the shared clock on by one physics step */
  advance(delta: number) {
    if (Number.isFinite(delta) && delta > 0) {
      this.elapsed = (this.elapsed + delta) % knotRotationPeriod
    }
  }

  isShowcased(body: RigidBody) {
    return !this.released.has(body)
  }

  release(body: RigidBody) {
    if (this.released.has(body)) {
      return false
    }
    this.released.add(body)
    if (body.isFixed()) {
      body.setBodyType(RigidBodyType.Dynamic, true)
    }
    body.wakeUp()
    return true
  }

  /** sets the shared clock to an absolute time in seconds */
  set(seconds: number) {
    this.elapsed = seconds % knotRotationPeriod
  }

  /** turns a showcased Knot to the shared clock’s angle, on top of the rotation it had when it was first stepped */
  step(body: RigidBody) {
    if (this.released.has(body) || !body.isFixed()) {
      return
    }
    let base = this.bases.get(body)
    if (!base) {
      const {x, y, z, w} = body.rotation()
      base = new Quaternion(x, y, z, w)
      this.bases.set(body, base)
    }
    const halfAngle = this.elapsed * Math.PI / knotRotationPeriod
    this.increment.set(0, Math.sin(halfAngle), 0, Math.cos(halfAngle))
    this.rotation.copy(base).premultiply(this.increment).normalize()
    body.setRotation(this.rotation, true)
  }
}
