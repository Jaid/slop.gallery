import type {Recipe, ToolCall} from 'capture-session/script'

import {recipeDuration, recipeToolCalls} from 'capture-session/script'

/** Maps captured frames to recipe time. Picture, wireframe and one-shot tools all follow the same clock. */
export class FilmRecipeClock {
  /** the length of each clip in frames, as recorded: its share of the movie and the crossfade out of it */
  readonly clipFrames: ReadonlyArray<number>
  readonly #calls: Map<number, Array<ToolCall>>
  readonly #continueAcrossClips: boolean

  /**
   * `durations` gives the seconds every clip shows in the movie, or one length for all of them; without it, every clip shows as long as the recipe.
   * A clip that crossfades into the next, which with `loop` the last one does into the first too, records `crossfade` seconds longer, so the movie lasts as long as its clips together.
   */
  constructor(recipe: Recipe, readonly fps: number, durations?: ReadonlyArray<number>, clips = 1, {crossfade = 0, loop = false} = {}) {
    const end = recipeDuration(recipe)
    if (durations === undefined && end === 0) {
      throw new Error('Give --duration or a recipe with a keyframe after 0 seconds.')
    }
    const given = durations ?? [end]
    if (given.length !== 1 && given.length !== clips) {
      throw new Error(`--duration gives ${given.length} lengths for ${clips} clips: give one for all of them or one per clip.`)
    }
    const seconds = given.length === 1 ? Array.from({length: clips}, () => given[0]) : given
    const shares = seconds.map(length => {
      if (!Number.isFinite(length) || length <= 0) {
        throw new Error('--duration must be a positive number of seconds.')
      }
      const frames = Math.max(1, Math.round(length * fps))
      if (!Number.isSafeInteger(frames)) {
        throw new TypeError('The film duration and fps exceed the supported frame count.')
      }
      return frames
    })
    if (!Number.isFinite(crossfade) || crossfade < 0) {
      throw new Error('--crossfade expects a non-negative duration in seconds.')
    }
    // A single clip has nothing to fade into, unless the movie loops back into its beginning.
    const fadeFrames = clips === 1 && !loop ? 0 : Math.round(crossfade * fps)
    const shortest = Math.min(...shares)
    if (fadeFrames > shortest) {
      throw new Error(`--crossfade is too long: it can last at most as long as the shortest clip, ${shortest / fps} s.`)
    }
    this.clipFrames = shares.map((frames, clip) => frames + (loop || clip < clips - 1 ? fadeFrames : 0))
    // Each clip plays the whole recipe only if every clip has room for it; otherwise the clips share one continuous flight.
    this.#continueAcrossClips = seconds.some(length => length < end)
    const loops = seconds.every(length => length === end)
    this.#calls = Map.groupBy(recipeToolCalls(recipe), call => {
      const frame = Math.ceil(call.time * fps - 1e-6)
      // On a full recipe loop, a tool on the closing keyframe runs at the seam. Trimmed and extended takes instead run tools only when they reach them.
      return loops ? frame % shares[0] : frame
    })
  }

  /** With `cycle`, the frames of a movie that loops, a continuous flight wraps round to its start there, so the last clip’s crossfade into the first shows the same moment on both sides. */
  take(clip: number, stitchedStart: number, startingFrame: number, cycle?: number) {
    const frameCount = this.clipFrames[clip]
    const continuous = this.#continueAcrossClips
    const start = continuous ? stitchedStart : 0
    const localFrame = (index: number) => (index + startingFrame - 1) % frameCount
    const recipeFrame = (index: number) => (cycle && continuous ? (start + localFrame(index)) % cycle : start + localFrame(index))
    return {
      frameCount,
      // World animations keep running even when each take repeats the camera recipe.
      animationSecondsAt: (index: number) => (stitchedStart + localFrame(index)) / this.fps,
      secondsAt: (index: number) => recipeFrame(index) / this.fps,
      callsAt: (index: number) => this.#calls.get(recipeFrame(index)),
    }
  }
}
