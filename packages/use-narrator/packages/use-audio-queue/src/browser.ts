import type {AudioPlayback, AudioTask} from './types.ts'

export type AudioReference = Blob | URL | string
export type AudioFileOptions = {
  /** Owns only this connection. The returned cleanup must not close a shared AudioContext. */
  connect?: (audio: HTMLAudioElement) => () => void
  /** For example, resume an app-owned AudioContext before creating a media source. */
  prepare?: (signal: AbortSignal) => Promise<void> | void
  volume?: number
}

export type AudioBufferOptions = Omit<AudioFileOptions, 'connect'> & {
  /** Owns only this connection: the node the decoded audio leaves at its volume, by default into the context’s destination. The returned cleanup must not close the shared AudioContext. */
  connect?: (output: AudioNode) => () => void
  /** the context to decode the audio for and play it through */
  context: BaseAudioContext
}

/** Lazy, independently pausable HTML audio. Caller-owned URLs are never revoked. */
export function audioFile<T extends object = Record<string, never>>(reference: AudioReference, options: AudioFileOptions = {}): AudioTask<T> {
  return async ({signal}) => {
    signal.throwIfAborted()
    await options.prepare?.(signal)
    signal.throwIfAborted()
    const volume = options.volume ?? 1
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('Audio volume must be between zero and one.')
    }
    const {owned, source} = sourceFor(reference)
    let audio: HTMLAudioElement | undefined
    let disconnect: (() => void) | undefined
    const state = {
      disposed: false,
      version: 0,
      wanted: false,
    }
    const completion = Promise.withResolvers<void>()
    // A load error can precede the queue attaching its observer.
    void completion.promise.catch(() => {})
    const ended = () => completion.resolve()
    const failed = () => completion.reject(new Error('Audio playback failed.'))
    const dispose = () => {
      if (state.disposed) {
        return
      }
      state.disposed = true
      state.wanted = false
      state.version++
      signal.removeEventListener('abort', dispose)
      audio?.removeEventListener('ended', ended)
      audio?.removeEventListener('error', failed)
      audio?.pause()
      try {
        disconnect?.()
      } finally {
        audio?.removeAttribute('src')
        audio?.load()
        if (owned) {
          URL.revokeObjectURL(owned)
        }
        completion.resolve()
      }
    }
    try {
      audio = new Audio(source)
      audio.preload = 'auto'
      audio.volume = volume
      audio.addEventListener('ended', ended)
      audio.addEventListener('error', failed)
      disconnect = options.connect?.(audio)
      signal.addEventListener('abort', dispose, {once: true})
      signal.throwIfAborted()
      const playback: AudioPlayback = {
        finished: completion.promise,
        play: async () => {
          signal.throwIfAborted()
          if (state.disposed) {
            throw new Error('Audio playback was disposed.')
          }
          state.wanted = true
          const startVersion = ++state.version
          await audio!.play()
          // A stale start may resolve after pause/disposal. Do not let it resurrect output. pause() can reset wanted meanwhile, which the narrowing from the assignment above cannot see.
          if (startVersion !== state.version && !(state.wanted as boolean)) {
            audio!.pause()
          }
        },
        pause: () => {
          state.wanted = false
          state.version++
          audio!.pause()
        },
        dispose,
        progress: () => ({
          seconds: audio!.currentTime,
          duration: Number.isFinite(audio!.duration) ? audio!.duration : undefined,
        }),
      }
      return playback
    } catch (error) {
      dispose()
      throw error
    }
  }
}

/**
 * Decoded audio played through an application-owned Web Audio context, independently pausable like {@link audioFile}: on the context’s own clock, so it keeps time with the rest of the context’s sound, also in one that can’t take media elements, like an offline context rendering a film.
 * The whole recording is fetched and decoded before it plays. Caller-owned URLs are never revoked.
 */
export function audioBuffer<T extends object = Record<string, never>>(reference: AudioReference, options: AudioBufferOptions): AudioTask<T> {
  return async ({signal}) => {
    signal.throwIfAborted()
    await options.prepare?.(signal)
    signal.throwIfAborted()
    const volume = options.volume ?? 1
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('Audio volume must be between zero and one.')
    }
    const {context} = options
    const bytes = reference instanceof Blob ? await reference.arrayBuffer() : await fetchBytes(reference, signal)
    signal.throwIfAborted()
    const buffer = await context.decodeAudioData(bytes)
    signal.throwIfAborted()
    const output = new GainNode(context, {gain: volume})
    let disconnect = connectedNowhere
    if (options.connect) {
      disconnect = options.connect(output)
    } else {
      output.connect(context.destination)
    }
    let source: AudioBufferSourceNode | undefined
    /** seconds into the recording where it stopped, or where the current source started */
    let offset = 0
    /** when the current source started, in the context’s seconds */
    let startedAt = 0
    let disposed = false
    const completion = Promise.withResolvers<void>()
    void completion.promise.catch(() => {})
    const position = () => (source ? Math.min(buffer.duration, offset + context.currentTime - startedAt) : offset)
    const halt = () => {
      if (!source) {
        return
      }
      const current = source
      source = undefined
      current.stop()
      current.disconnect()
    }
    const dispose = () => {
      if (disposed) {
        return
      }
      disposed = true
      signal.removeEventListener('abort', dispose)
      halt()
      try {
        disconnect()
      } finally {
        output.disconnect()
        completion.resolve()
      }
    }
    signal.addEventListener('abort', dispose, {once: true})
    return {
      finished: completion.promise,
      play: () => {
        signal.throwIfAborted()
        if (disposed) {
          throw new Error('Audio playback was disposed.')
        }
        if (source) {
          return
        }
        const next = new AudioBufferSourceNode(context, {buffer})
        next.connect(output)
        // A source stopped by a pause has been replaced or dropped by then, so only a natural end counts.
        next.addEventListener('ended', () => {
          if (source !== next) {
            return
          }
          source = undefined
          offset = buffer.duration
          next.disconnect()
          completion.resolve()
        }, {once: true})
        startedAt = context.currentTime
        next.start(startedAt, Math.min(offset, buffer.duration))
        source = next
      },
      pause: () => {
        offset = position()
        halt()
      },
      dispose,
      progress: () => ({
        seconds: position(),
        duration: buffer.duration,
      }),
    }
  }
}

/** the cleanup of output connected straight into the destination, which goes with the output itself */
function connectedNowhere() {}
async function fetchBytes(reference: URL | string, signal: AbortSignal) {
  const response = await fetch(reference, {signal})
  if (!response.ok) {
    throw new Error(`Audio could not be loaded (${response.status}).`)
  }
  return response.arrayBuffer()
}
function sourceFor(reference: AudioReference) {
  if (reference instanceof Blob) {
    const source = URL.createObjectURL(reference)
    return {
      owned: source,
      source,
    }
  }
  return {
    owned: undefined,
    source: reference instanceof URL ? reference.href : reference,
  }
}
