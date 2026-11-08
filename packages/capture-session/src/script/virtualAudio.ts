export type VirtualAudioOptions = {
  /** how many channels every context renders and the recording has. Default: 2 */
  channels?: number
  /** seconds of sound the recording holds from the moment the page first renders sound, which is as far as any context can render */
  duration: number
  /** samples per second of every context and of the recording. Default: 48 000 */
  sampleRate?: number
}
/** what the page’s audio contexts rendered, mixed: interleaved samples of every channel, frame by frame, the format ffmpeg reads as `f32le` */
export type VirtualAudioRecording = {
  channels: number
  sampleRate: number
  samples: Float32Array<ArrayBuffer>
}
export type VirtualAudio = {
  /** Renders every audio context of the page `seconds` further, resolving once it got there. Call it before stepping the virtual clock by as much, so the sounds the next frame starts begin at its own moment. */
  advance: (seconds: number) => Promise<void>
  /** Renders what is left up to the duration and resolves with the recording, or undefined if the page never made an audio context. Contexts can’t render any further afterward. */
  finish: () => Promise<VirtualAudioRecording | undefined>
  /** seconds rendered so far, the time every context made at the start stands at */
  readonly time: number
}

declare global {
  var virtualAudio: VirtualAudio | undefined
}

/**
 * Page init script that lets an offline renderer own the clock of the page’s sound and record it, like the virtual clock owns that of its frames: every `AudioContext` the page makes is an `OfflineAudioContext` that only renders as far as {@link VirtualAudio.advance} takes it, so sounds stay in step with the frames however slowly each renders.
 * The contexts play from the start, as no autoplay policy holds them back, and say so through `navigator.getAutoplayPolicy()`; they report themselves running, and resuming, suspending or closing them does nothing. Media elements can’t play through them, as an offline context has no `createMediaElementSource`.
 * It must stay self-contained: Puppeteer serializes it into the page, with its options as JSON.
 */
export const installVirtualAudio = ({channels = 2, duration, sampleRate = 48_000}: VirtualAudioOptions) => {
  /** how many sample frames a render quantum holds, the step an offline context suspends at */
  const quantum = 128
  const length = Math.max(quantum, Math.ceil(duration * sampleRate))
  /** seconds rendered so far */
  let time = 0
  let finished = false
  /** the sample frame every context rendered up to, on the render quantum nearest to `time` */
  const reached = () => Math.round(time * sampleRate / quantum) * quantum
  const contexts: Array<VirtualAudioContext> = []
  class VirtualAudioContext extends OfflineAudioContext {
    readonly baseLatency = 0
    /** the sample frame of the recording its own time 0 falls on, later than 0 for a context made once the recording was underway */
    readonly offset: number
    readonly outputLatency = 0
    #rendering?: Promise<AudioBuffer>
    // Live contexts take options like a latency hint, which mean nothing offline.
    constructor(_options?: AudioContextOptions) {
      const offset = Math.min(reached(), length - quantum)
      super({
        numberOfChannels: channels,
        length: length - offset,
        sampleRate,
      })
      this.offset = offset
      contexts.push(this)
    }
    override get state(): AudioContextState {
      return 'running'
    }
    close() {
      return Promise.resolve()
    }
    getOutputTimestamp(): AudioTimestamp {
      return {
        contextTime: this.currentTime,
        performanceTime: performance.now(),
      }
    }
    /** Renders what is left and resolves with everything it rendered. */
    async renderAll() {
      if (!this.#rendering) {
        this.#rendering = this.startRendering()
      } else if (this.#frame() < this.length) {
        // Rendering may have run to its end already, where resuming fails.
        await super.resume()
      }
      return this.#rendering
    }
    /** Renders up to the sample frame `target` of the recording, rounded to the nearest render quantum, or to its end. */
    async renderTo(target: number) {
      const own = Math.round((target - this.offset) / quantum) * quantum
      if (own <= this.#frame()) {
        return
      }
      if (own >= this.length) {
        await this.renderAll()
        return
      }
      const suspended = super.suspend(own / sampleRate)
      if (this.#rendering) {
        await super.resume()
      } else {
        this.#rendering = this.startRendering()
      }
      await suspended
    }
    override resume() {
      return Promise.resolve()
    }
    override suspend() {
      return Promise.resolve()
    }
    #frame() {
      return Math.round(this.currentTime * sampleRate)
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: VirtualAudioContext,
  })
  Object.defineProperty(navigator, 'getAutoplayPolicy', {
    configurable: true,
    value: () => 'allowed',
  })
  globalThis.virtualAudio = {
    get time() {
      return time
    },
    advance: async seconds => {
      if (finished) {
        throw new Error('The virtual audio has finished recording.')
      }
      time += seconds
      const target = Math.round(time * sampleRate)
      await Promise.all(contexts.map(context => context.renderTo(target)))
    },
    finish: async () => {
      finished = true
      if (contexts.length === 0) {
        return
      }
      const buffers = await Promise.all(contexts.map(context => context.renderAll()))
      const samples = new Float32Array(length * channels)
      for (const [index, buffer] of buffers.entries()) {
        const {offset} = contexts[index]
        for (let channel = 0; channel < channels; channel++) {
          const data = buffer.getChannelData(channel)
          for (const [frame, datum] of data.entries()) {
            samples[(offset + frame) * channels + channel] += datum
          }
        }
      }
      return {
        channels,
        sampleRate,
        samples,
      }
    },
  }
}
