import type {AudioTrack, FrameSink} from 'capture-session/script'

import {join} from 'node:path'

/** One frame-quantized timeline for picture and sound. Only neighboring takes can overlap. */
export class StitchTimeline {
  audio?: AudioTrack
  readonly fadeFrames: number
  readonly frameCount: number

  constructor(readonly clips: number, readonly clipFrames: number, readonly fps: number, fadeSeconds: number) {
    if (!Number.isFinite(fadeSeconds) || fadeSeconds < 0) {
      throw new Error('--crossfade expects a non-negative duration in seconds.')
    }
    this.fadeFrames = clips === 1 ? 0 : Math.round(fadeSeconds * fps)
    const limit = clips > 2 ? Math.floor(clipFrames / 2) : clipFrames
    if (this.fadeFrames > limit) {
      throw new Error(`--crossfade is too long: these clips have room for ${limit} frames of overlap (${limit / fps} s).`)
    }
    this.frameCount = clips * clipFrames - (clips - 1) * this.fadeFrames
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
    const firstFrame = clip * (this.clipFrames - this.fadeFrames)
    const start = at(firstFrame)
    const end = at(firstFrame + this.clipFrames)
    const fadeIn = clip === 0 ? 0 : at(firstFrame + this.fadeFrames) - start
    const fadeOut = clip === this.clips - 1 ? 0 : end - at(firstFrame + this.clipFrames - this.fadeFrames)
    const length = Math.min(end - start, samples.length / channels)
    for (let frame = 0; frame < length; frame++) {
      const remaining = end - start - frame
      const gain = frame < fadeIn ? (frame + 0.5) / fadeIn : (remaining <= fadeOut ? (remaining - 0.5) / fadeOut : 1)
      for (let channel = 0; channel < channels; channel++) {
        output.samples[(start + frame) * channels + channel] += samples[frame * channels + channel] * gain
      }
    }
  }

  /** Spools just the outgoing overlap to disk so even high-resolution fades need only two frames in memory. */
  writer(clip: number, write: FrameSink['write'], scratch?: string): FrameSink['write'] {
    const {clipFrames, clips, fadeFrames} = this
    if (!fadeFrames) {
      return write
    }
    let next = 0
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
