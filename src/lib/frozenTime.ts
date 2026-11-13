import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'
import {NodeFrame} from 'three/webgpu'

import world from '#src/worlds/current.ts'

import {readDevelopmentMode} from './developmentMode.ts'
import {readSpawn} from './gallery/spawn.ts'
import worldTime from './worldTime.ts'

const frozenTimeSchema = optis({
  normalizations: {
    frozen_time(value: unknown) {
      try {
        const seconds = parseNumber(value)
        if (seconds >= 0) {
          return seconds
        }
      } catch {
      }
    },
  },
})
/** Read the optional `?frozen_time` from the permalink, or else, without `?development`, the `frozenTime` of the `?spawn` camera bookmark: the engine time in seconds that every animation stands still at, so captures of the same view match. Only animations stand still: physics, the player and a flying camera keep moving through the frozen world. */
export function readFrozenTime(input: URL | string = typeof location === 'undefined' ? '' : location.href): number | undefined {
  const spawn = readDevelopmentMode(input) ? '' : readSpawn(input)
  return readPermalink(input, {schema: frozenTimeSchema}).frozen_time ?? (spawn ? world.cameraBookmarks().find(bookmark => bookmark.id === spawn)?.frozenTime : undefined)
}

/** the seconds of `?frozen_time`, or undefined while the engine time runs */
export const frozenSeconds = readFrozenTime()

// NodeFrame normally measures wall time independently of Fiber, so merely stopping the Canvas would make shaders jump ahead on resume. Every renderer follows the world clock; ?frozen_time still overrides animation time for captures.
const lastUpdates = new WeakMap<NodeFrame, number>
// eslint-disable-next-line typescript/unbound-method -- called with the frame as this
const {update} = NodeFrame.prototype
NodeFrame.prototype.update = function (this: NodeFrame) {
  const now = worldTime.now()
  const delta = (now - (lastUpdates.get(this) ?? now)) / 1000
  const elapsed = this.time + delta
  update.call(this)
  lastUpdates.set(this, now)
  this.deltaTime = delta
  this.time = frozenSeconds ?? elapsed
}

/** The time of a CPU-side animation in seconds: the frame deltas summed up, each capped at `maxDelta`, or the frozen seconds under `?frozen_time`, like the shaders’ time. */
export class AnimationClock {
  private elapsed = 0

  constructor(private readonly maxDelta = Infinity) {}

  /** the animation’s time in seconds as of the last {@link advance} */
  get time() {
    return frozenSeconds ?? this.elapsed
  }

  /** adds a frame’s delta in seconds and returns the animation’s time */
  advance(delta: number) {
    if (frozenSeconds !== undefined) {
      return frozenSeconds
    }
    this.elapsed += Math.min(delta, this.maxDelta)
    return this.elapsed
  }
}
