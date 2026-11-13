import {NodeFrame} from 'three/webgpu'

import {frozenSeconds} from '../frozenTime.ts'
import worldClock from '../worldClock.ts'

/** when each node frame last updated, by the world’s clock, in ms */
const updated = new WeakMap<NodeFrame, number>
// eslint-disable-next-line typescript/unbound-method -- called with the frame as this
const {update} = NodeFrame.prototype
// Every renderer’s node time, which shaders read as TSL `time`, follows the world’s clock instead of the wall clock three counts it by, so it stands still while the world is frozen and goes on right where it stood, whoever updates it and however often: three’s own animation loop keeps doing so while nothing renders.
// Under `?frozen_time`, it stands at those seconds from its first frame on. Nothing else reads it, so the real clock still drives physics and input.
NodeFrame.prototype.update = function (this: NodeFrame) {
  const {time} = this
  update.call(this)
  const now = worldClock.now()
  this.deltaTime = (now - (updated.get(this) ?? now)) / 1000
  updated.set(this, now)
  this.time = frozenSeconds ?? time + this.deltaTime
}
