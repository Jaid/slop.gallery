import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'
import {NodeFrame} from 'three/webgpu'

import world from '#src/worlds/current.ts'

import {readDevelopmentMode} from './developmentMode.ts'
import {readSpawn} from './gallery/spawn.ts'

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

const worldClock = {
  paused: false,
  pausedAt: 0,
  pausedDuration: 0,
}

/** Whether the world simulation clock is currently paused, e.g. while the Escape pause menu is open. */
export function isWorldClockPaused(): boolean {
  return worldClock.paused
}

/** The world clock in milliseconds, advancing like `performance.now()` except while paused by the Escape pause menu. */
export function worldNow(): number {
  return worldClock.paused ? worldClock.pausedAt - worldClock.pausedDuration : performance.now() - worldClock.pausedDuration
}

/** Pauses or resumes the world simulation clock without jumping ahead on resume. */
export function setWorldClockPaused(paused: boolean): void {
  if (paused === worldClock.paused) {
    return
  }
  const now = performance.now()
  if (paused) {
    worldClock.paused = true
    worldClock.pausedAt = now
  } else {
    worldClock.paused = false
    worldClock.pausedDuration += Math.max(0, now - worldClock.pausedAt)
  }
}

// Every renderer’s node time, which shaders read as TSL `time`, stands still at the frozen seconds under `?frozen_time`, and otherwise follows the pausable world clock so Escape pause freezes shaders and resumes without jumping.
// eslint-disable-next-line typescript/unbound-method -- called with the frame as this
const {update} = NodeFrame.prototype
const lastWorldTimes = new WeakMap<NodeFrame, number>
NodeFrame.prototype.update = function (this: NodeFrame) {
  if (frozenSeconds !== undefined) {
    update.call(this)
    this.time = frozenSeconds
    return
  }
  const now = worldNow()
  const previous = lastWorldTimes.get(this) ?? now
  lastWorldTimes.set(this, now)
  const previousTime = this.time
  update.call(this)
  const delta = Math.max(0, (now - previous) / 1000)
  this.deltaTime = delta
  this.time = previousTime + delta
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
    if (worldClock.paused) {
      return this.elapsed
    }
    this.elapsed += Math.min(delta, this.maxDelta)
    return this.elapsed
  }
}
