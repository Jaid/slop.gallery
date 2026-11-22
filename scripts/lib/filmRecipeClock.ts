import type {Recipe, ToolCall} from 'capture-session/script'

import {recipeDuration, recipeToolCalls} from 'capture-session/script'

/** Maps captured frames to recipe time. Picture, wireframe and one-shot tools all follow the same clock. */
export class FilmRecipeClock {
  /** the length of each clip in frames */
  readonly clipFrames: ReadonlyArray<number>
  readonly #calls: Map<number, Array<ToolCall>>
  readonly #continueAcrossClips: boolean

  /** `durations` gives the seconds of every clip, or one length for all of them; without it, every clip lasts as long as the recipe. */
  constructor(recipe: Recipe, readonly fps: number, durations?: ReadonlyArray<number>, clips = 1) {
    const end = recipeDuration(recipe)
    if (durations === undefined && end === 0) {
      throw new Error('Give --duration or a recipe with a keyframe after 0 seconds.')
    }
    const given = durations ?? [end]
    if (given.length !== 1 && given.length !== clips) {
      throw new Error(`--duration gives ${given.length} lengths for ${clips} clips: give one for all of them or one per clip.`)
    }
    const seconds = given.length === 1 ? Array.from({length: clips}, () => given[0]) : given
    this.clipFrames = seconds.map(length => {
      if (!Number.isFinite(length) || length <= 0) {
        throw new Error('--duration must be a positive number of seconds.')
      }
      const frames = Math.max(1, Math.round(length * fps))
      if (!Number.isSafeInteger(frames)) {
        throw new TypeError('The film duration and fps exceed the supported frame count.')
      }
      return frames
    })
    // Each clip plays the whole recipe only if every clip has room for it; otherwise the clips share one continuous flight.
    this.#continueAcrossClips = seconds.some(length => length < end)
    const loops = seconds.every(length => length === end)
    this.#calls = Map.groupBy(recipeToolCalls(recipe), call => {
      const frame = Math.ceil(call.time * fps - 1e-6)
      // On a full recipe loop, a tool on the closing keyframe runs at the seam. Trimmed and extended takes instead run tools only when they reach them.
      return loops ? frame % this.clipFrames[0] : frame
    })
  }

  take(clip: number, stitchedStart: number, startingFrame: number) {
    const frameCount = this.clipFrames[clip]
    const start = this.#continueAcrossClips ? stitchedStart : 0
    const localFrame = (index: number) => (index + startingFrame - 1) % frameCount
    const recipeFrame = (index: number) => start + localFrame(index)
    return {
      frameCount,
      // World animations keep running even when each take repeats the camera recipe.
      animationSecondsAt: (index: number) => (stitchedStart + localFrame(index)) / this.fps,
      secondsAt: (index: number) => recipeFrame(index) / this.fps,
      callsAt: (index: number) => this.#calls.get(recipeFrame(index)),
    }
  }
}
