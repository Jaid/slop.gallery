import type {Recipe, ToolCall} from 'capture-session/script'

import {recipeDuration, recipeToolCalls} from 'capture-session/script'

/** Maps captured frames to recipe time. Picture, wireframe and one-shot tools all follow the same clock. */
export class FilmRecipeClock {
  readonly clipFrames: number
  readonly #calls: Map<number, Array<ToolCall>>
  readonly #continueAcrossClips: boolean

  constructor(recipe: Recipe, readonly fps: number, duration?: number) {
    const end = recipeDuration(recipe)
    if (duration === undefined && end === 0) {
      throw new Error('Give --duration or a recipe with a keyframe after 0 seconds.')
    }
    const seconds = duration ?? end
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('--duration must be a positive number of seconds.')
    }
    this.clipFrames = Math.max(1, Math.round(seconds * fps))
    if (!Number.isSafeInteger(this.clipFrames)) {
      throw new TypeError('The film duration and fps exceed the supported frame count.')
    }
    this.#continueAcrossClips = seconds < end
    this.#calls = Map.groupBy(recipeToolCalls(recipe), call => {
      const frame = Math.ceil(call.time * fps - 1e-6)
      // On a full recipe loop, a tool on the closing keyframe runs at the seam. Trimmed and extended takes instead run tools only when they reach them.
      return seconds === end ? frame % this.clipFrames : frame
    })
  }

  take(stitchedStart: number, startingFrame: number) {
    const start = this.#continueAcrossClips ? stitchedStart : 0
    const recipeFrame = (index: number) => start + (index + startingFrame - 1) % this.clipFrames
    return {
      secondsAt: (index: number) => recipeFrame(index) / this.fps,
      callsAt: (index: number) => this.#calls.get(recipeFrame(index)),
    }
  }
}
