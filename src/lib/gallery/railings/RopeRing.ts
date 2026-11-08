import {Curve, Vector3} from 'three/webgpu'

import {ropeTop} from './stanchion.ts'

/** The ropes of a closed ring of posts, hanging from post to post and `sag` below their ends in their middle, starting at the post half a span past `facing` (an angle from +x toward +z), so the middle of a rope faces that way. */
export default class RopeRing extends Curve<Vector3> {
  constructor(readonly radius: number, readonly count: number, readonly sag: number, readonly facing = 0) {
    super()
  }

  getPoint(t: number, target = new Vector3) {
    const angle = this.facing + (t + 0.5 / this.count) * Math.PI * 2
    return target.set(Math.cos(angle) * this.radius, ropeTop - Math.abs(Math.sin(t * this.count * Math.PI)) * this.sag, Math.sin(angle) * this.radius)
  }
}
