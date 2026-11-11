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
  /* eslint-disable typescript/method-signature-style -- Methods merge with the DOM’s own: startRendering as an overload, close as what the context overrides. */
  interface OfflineAudioContext {
    /** Stops rendering for good. Part of incremental rendering, which TypeScript’s DOM types don’t know yet. */
    close(): Promise<void>
    /** Renders the next `chunkSize` sample frames, rounded up to whole render quanta and cut off at the context’s length, and resolves with just those (https://webaudio.github.io/web-audio-api/#dom-offlineaudiocontext-startrendering). The context closes once it rendered its length. */
    startRendering(chunkSize?: number): Promise<AudioBuffer>
  }
  /* eslint-enable typescript/method-signature-style */
}

/**
 * Page init script that lets an offline renderer own the clock of the page’s sound and record it, like the virtual clock owns that of its frames: every `AudioContext` the page makes is an `OfflineAudioContext` that only renders as far as {@link VirtualAudio.advance} takes it, so sounds stay in step with the frames however slowly each renders. Each advance renders the next chunk of every context and mixes it into the recording right away, so no context holds more than that chunk.
 * The contexts play from the start, as no autoplay policy holds them back, and say so through `navigator.getAutoplayPolicy()`; they report themselves running, and resuming, suspending or closing them does nothing. Media elements can’t play through them, as an offline context has no `createMediaElementSource`.
 * It needs incremental offline rendering, which Chromium ships from 158 on and earlier versions have behind `--enable-features=OfflineAudioContextIncrementalRendering`. Without it, the page keeps its own audio contexts and every advance and finish rejects.
 * It must stay self-contained: Puppeteer serializes it into the page, with its options as JSON.
 */
export const installVirtualAudio = ({channels = 2, duration, sampleRate = 48_000}: VirtualAudioOptions) => {
  // The explainer’s feature detection: close came with incremental rendering.
  if (!('close' in OfflineAudioContext.prototype)) {
    const unsupported = () => Promise.reject(new Error('Virtual audio needs incremental OfflineAudioContext rendering, which Chromium ships from 158 on. Launch earlier versions with --enable-features=OfflineAudioContextIncrementalRendering.'))
    globalThis.virtualAudio = {
      time: 0,
      advance: unsupported,
      finish: unsupported,
    }
    return
  }
  /** how many sample frames a render quantum holds, the step an offline context renders in */
  const quantum = 128
  const length = Math.max(quantum, Math.ceil(duration * sampleRate))
  /** seconds rendered so far */
  let time = 0
  let finished = false
  /** the mix, made along with the first context */
  let samples: Float32Array<ArrayBuffer> | undefined
  /** the sample frame every context rendered up to, on the render quantum nearest to `time` */
  const reached = () => Math.round(time * sampleRate / quantum) * quantum
  const contexts: Array<VirtualAudioContext> = []
  class VirtualAudioContext extends OfflineAudioContext {
    readonly baseLatency = 0
    /** the sample frame of the recording its own time 0 falls on, later than 0 for a context made once the recording was underway */
    readonly offset: number
    readonly outputLatency = 0
    /** how many of its sample frames it rendered and mixed in */
    #rendered = 0
    // Live contexts take options like a latency hint, which mean nothing offline.
    constructor(_options?: AudioContextOptions) {
      const offset = Math.min(reached(), length - quantum)
      super({
        numberOfChannels: channels,
        length: length - offset,
        sampleRate,
      })
      this.offset = offset
      samples ??= new Float32Array(length * channels)
      contexts.push(this)
    }
    override get state(): AudioContextState {
      return 'running'
    }
    override close() {
      return Promise.resolve()
    }
    getOutputTimestamp(): AudioTimestamp {
      return {
        contextTime: this.currentTime,
        performanceTime: performance.now(),
      }
    }
    /** Renders what is left. */
    renderAll() {
      return this.#renderUntil(this.length)
    }
    /** Renders up to the sample frame `target` of the recording, rounded to the nearest render quantum, or to its end. */
    renderTo(target: number) {
      return this.#renderUntil(Math.min(this.length, Math.round((target - this.offset) / quantum) * quantum))
    }
    override resume() {
      return Promise.resolve()
    }
    override suspend() {
      return Promise.resolve()
    }
    /** Renders the chunk up to its own sample frame `end`, a whole number of render quanta past what it rendered unless `end` is its length, and mixes it into the recording. */
    async #renderUntil(end: number) {
      if (end <= this.#rendered) {
        return
      }
      const chunk = await super.startRendering(end - this.#rendered)
      const start = (this.offset + this.#rendered) * channels
      for (let channel = 0; channel < channels; channel++) {
        const data = chunk.getChannelData(channel)
        for (const [frame, datum] of data.entries()) {
          samples![start + frame * channels + channel] += datum
        }
      }
      this.#rendered += chunk.length
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
      if (!samples) {
        return
      }
      await Promise.all(contexts.map(context => context.renderAll()))
      return {
        channels,
        sampleRate,
        samples,
      }
    },
  }
}
