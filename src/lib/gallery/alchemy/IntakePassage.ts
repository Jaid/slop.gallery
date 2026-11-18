import type {RigidBody} from '@dimforge/rapier3d-compat'

import {Line3, Vector3} from 'three/webgpu'

import {alchemyIntake, alchemySink, inBodyInlet} from './alchemyMachine.ts'
import {pipeCenterline} from './PipeGeometry.ts'

const [sinkX, rimY, sinkZ] = alchemySink.center
const {throat, throatY} = alchemySink
const {points} = pipeCenterline(alchemyIntake.corners, alchemyIntake.bend)
const path = [new Vector3(sinkX, throatY, sinkZ), ...points]
const segments = points.map((point, i) => new Line3(path[i], point))

/** Only a free orb seen inside the bowl can finish a passage through its pipe. Sample once per physics step. */
export default class IntakePassage {
  private readonly entered = new WeakSet<RigidBody>
  private readonly nearest = new Vector3
  private readonly point = new Vector3

  reachedChest(body: RigidBody) {
    // Picking up or seizing an orb interrupts its passage.
    if (!body.isEnabled()) {
      this.entered.delete(body)
      return false
    }
    const {x, y, z} = body.translation()
    if (y >= throatY) {
      // This column is wholly inside the bowl, even at its narrowest point.
      if (y < rimY && Math.hypot(x - sinkX, z - sinkZ) < throat) {
        this.entered.add(body)
      } else {
        this.entered.delete(body)
      }
      return false
    }
    if (!this.entered.has(body)) {
      return false
    }
    this.point.set(x, y, z)
    if (!segments.some(segment => segment.closestPointToPoint(this.point, true, this.nearest).distanceToSquared(this.point) < throat ** 2)) {
      this.entered.delete(body)
      return false
    }
    if (!inBodyInlet([x, y, z])) {
      return false
    }
    this.entered.delete(body)
    return true
  }
}
