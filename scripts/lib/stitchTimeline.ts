import type {AudioTrack, FrameSink} from 'capture-session/script'

import {join} from 'node:path'

/** One frame-quantized timeline for picture and sound. Only neighboring takes can overlap. */
export class StitchTimeline {
  audio?: AudioTrack
  /** how many takes the movie stitches */
  readonly clips: number
  readonly fadeFrames: number
  readonly frameCount: number
  /** Frames to move from the beginning of the stitched output to its end. */
  readonly offset: number
  /** Single takes start their camera and virtual clock at the requested recipe frame, as usual. Stitched takes run the whole recipe in order. */
  readonly recipeStart: number
  readonly #starts: ReadonlyArray<number>

  /** `clipFrames` gives the length of each take in frames, in playing order. */
  constructor(readonly clipFrames: ReadonlyArray<number>, readonly fps: number, fadeSeconds: number, startingFrame = 1) {
    if (!Number.isFinite(fadeSeconds) || fadeSeconds < 0) {
      throw new Error('--crossfade expects a non-negative duration in seconds.')
    }
    const clips = clipFrames.length
    this.clips = clips
    this.fadeFrames = clips === 1 ? 0 : Math.round(fadeSeconds * fps)
    // A clip has to hold the overlap into it and the one out of it.
    const limit = Math.min(...clipFrames.map((frames, clip) => Math.floor(frames / (Number(clip > 0) + Number(clip < clips - 1) || 1))))
    if (this.fadeFrames > limit) {
      throw new Error(`--crossfade is too long: these clips have room for ${limit} frames of overlap (${limit / fps} s).`)
    }
    this.#starts = clipFrames.map((_, clip) => clipFrames.slice(0, clip).reduce((sum, frames) => sum + frames, 0) - clip * this.fadeFrames)
    this.frameCount = this.#starts[clips - 1] + clipFrames[clips - 1]
    if (!Number.isSafeInteger(startingFrame) || startingFrame < 1 || startingFrame > this.frameCount) {
      throw new Error(`--starting-frame must be a whole number between 1 and ${this.frameCount}.`)
    }
    this.recipeStart = clips === 1 ? startingFrame : 1
    this.offset = clips === 1 ? 0 : startingFrame - 1
  }

  /** First output frame of this take before rotating the seam; both sides of a crossfade cover the same output frames. */
  clipStart(clip: number) {
    return this.#starts[clip]
  }

  /** Place samples at absolute frame boundaries (no accumulated rounding at fractional fps). A missing track leaves silence. */
  mix(clip: number, track: AudioTrack) {
    if (this.clips === 1) {
      this.audio = track
      return
    }
    const {channels, sampleRate, samples} = track
    const at = (frame: number) => Math.round(frame * sampleRate / this.fps)
    this.audio ??= {
      channels,
      sampleRate,
      samples: new Float32Array(at(this.frameCount) * channels),
    }
    const output = this.audio
    if (output.channels !== channels || output.sampleRate !== sampleRate) {
      throw new Error('Audio format changed between takes.')
    }
    const firstFrame = this.clipStart(clip)
    const clipFrames = this.clipFrames[clip]
    const start = at(firstFrame)
    const end = at(firstFrame + clipFrames)
    const fadeIn = clip === 0 ? 0 : at(firstFrame + this.fadeFrames) - start
    const fadeOut = clip === this.clips - 1 ? 0 : end - at(firstFrame + clipFrames - this.fadeFrames)
    const length = Math.min(end - start, samples.length / channels)
    const sampleFrames = output.samples.length / channels
    let destination = (start - at(this.offset) + sampleFrames) % sampleFrames
    for (let frame = 0; frame < length; frame++) {
      const remaining = end - start - frame
      const gain = frame < fadeIn ? (frame + 0.5) / fadeIn : (remaining <= fadeOut ? (remaining - 0.5) / fadeOut : 1)
      for (let channel = 0; channel < channels; channel++) {
        // Both contributions are float32 before addition, so changing which take is captured first does not change the mix.
        output.samples[destination * channels + channel] += Math.fround(samples[frame * channels + channel] * gain)
      }
      destination = destination + 1 === sampleFrames ? 0 : destination + 1
    }
  }

  /** Captures every take once, starting with those needed from the seam onward. Only takes straddling the seam (two if it splits a crossfade) need their prefix saved for the wrap. */
  async stitch(capture: (clip: number, accept: FrameSink['write']) => Promise<void>, write: FrameSink['write'], scratch?: string) {
    const {clips, clipFrames, offset} = this
    const prefix = (clip: number) => Math.min(clipFrames[clip], Math.max(0, offset - this.clipStart(clip)))
    const saved = (clip: number, frame: number) => Bun.file(join(scratch!, `prefix-${clip}-${frame}`))
    for (let clip = 0; clip < clips; clip++) {
      const start = prefix(clip)
      if (start === clipFrames[clip]) {
        continue
      }
      const accept = this.writer(clip, write, scratch, start)
      let frame = 0
      await capture(clip, start === 0 ? accept : async pixels => {
        const index = frame++
        if (index < start) {
          await Bun.write(saved(clip, index), pixels)
        } else {
          await accept(pixels)
        }
      })
    }
    for (let clip = 0; clip < clips && prefix(clip) > 0; clip++) {
      const length = prefix(clip)
      const accept = this.writer(clip, write, scratch)
      if (length === clipFrames[clip]) {
        await capture(clip, accept)
      } else {
        for (let index = 0; index < length; index++) {
          await accept(await saved(clip, index).bytes())
        }
      }
    }
  }

  /** Spools the outgoing overlap to disk so even high-resolution fades need only two frames in memory. */
  private writer(clip: number, write: FrameSink['write'], scratch: string | undefined, firstFrame = 0): FrameSink['write'] {
    const {clips, fadeFrames} = this
    if (!fadeFrames) {
      return write
    }
    const clipFrames = this.clipFrames[clip]
    let next = firstFrame
    return async pixels => {
      const frame = next++
      if (clip < clips - 1 && frame >= clipFrames - fadeFrames) {
        await Bun.write(join(scratch!, String(frame - clipFrames + fadeFrames)), pixels)
        return
      }
      if (clip > 0 && frame < fadeFrames) {
        const previous = await Bun.file(join(scratch!, String(frame))).bytes()
        const weight = (frame + 0.5) / fadeFrames
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] = Math.round(previous[i] + (pixels[i] - previous[i]) * weight)
        }
      }
      await write(pixels)
    }
  }
}
