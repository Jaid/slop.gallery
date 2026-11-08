import type {NarrationInput, NarrationMetadata, NarrationPushOptions, NarrationReference, NarratorOptions, RecordingReference, SpeechReference, SpeechSynthesizer, SynthesizedSpeech} from './types.ts'
import type {AudioReference} from 'use-audio-queue/browser'
import type {AudioHandle, AudioPlayback, AudioProgress, AudioQueueSnapshot, AudioTask} from 'use-audio-queue/core'

import composeId from 'compose-id'
import {audioBuffer, audioFile} from 'use-audio-queue/browser'
import {AudioQueue} from 'use-audio-queue/core'

import {browserSpeech} from './browser.ts'
import fallbackPlayback from './fallbackPlayback.ts'

function normalize(reference: NarrationReference): RecordingReference | SpeechReference {
  if (typeof reference === 'string') {
    return {text: reference}
  }
  if (reference instanceof Blob || reference instanceof URL) {
    return {audio: reference}
  }
  return reference
}
const synthesized = (result: Awaited<ReturnType<SpeechSynthesizer>>): SynthesizedSpeech => (typeof result === 'string' || result instanceof Blob || result instanceof URL ? {audio: result} : result)

/** Application-owned narrator; components only enqueue and subscribe, never own shared playback. */
export default class Narrator implements Disposable {
  getSnapshot = (): AudioQueueSnapshot<NarrationMetadata> => this.queue.getSnapshot()
  readonly queue: AudioQueue<NarrationMetadata>
  subscribe = (listener: () => void) => this.queue.subscribe(listener)
  private disposed = false
  private enabledValue: boolean
  /** queue entry IDs of unfinished narrations by instance ID */
  private instances = new Map<string, string>

  private observed = new WeakSet<AudioHandle>

  private spoken = new Set<string>
  constructor(private readonly options: NarratorOptions = {}) {
    this.queue = new AudioQueue(options)
    this.enabledValue = options.enabled ?? true
  }

  get appendedSilence() {
    return this.queue.appendedSilence
  }
  set appendedSilence(value: number) {
    this.queue.appendedSilence = value
  }
  get enabled() {
    return this.enabledValue
  }
  set enabled(value: boolean) {
    this.enabledValue = value
    if (!value) {
      this.stop('disabled')
    }
  }
  get gap() {
    return this.queue.gap
  }
  set gap(value: number) {
    this.queue.gap = value
  }

  get prependedSilence() {
    return this.queue.prependedSilence
  }
  set prependedSilence(value: number) {
    this.queue.prependedSilence = value
  }
  clearHistory() {
    this.spoken.clear()
  }
  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.queue.dispose()
    this.spoken.clear()
    this.instances.clear()
  }
  forget(key: string) {
    this.spoken.delete(key)
  }

  hasSpoken(key: string) {
    return this.spoken.has(key)
  }

  /** Where a narration’s playback stands, by its `instanceId`, for visuals that follow the speech, like subtitles. Cheap enough to read every frame. */
  progress(instanceId: string): AudioProgress | undefined {
    const id = this.instances.get(instanceId)
    return id === undefined ? undefined : this.queue.progress(id)
  }

  push(input: NarrationInput, options: NarrationPushOptions = {}): AudioHandle {
    if (this.disposed) {
      throw new Error('Cannot push to a disposed narrator.')
    }
    if (!this.enabled) {
      return {
        id: composeId(),
        finished: Promise.resolve({
          status: 'skipped',
          reason: 'disabled',
        }),
        cancel() {},
      }
    }
    if (!options.repeat && options.once !== undefined && this.spoken.has(options.once)) {
      return {
        id: `remembered:${options.once}`,
        finished: Promise.resolve({
          status: 'skipped',
          reason: 'remembered',
        }),
        cancel() {},
      }
    }
    const immediate = typeof input === 'function' ? undefined : normalize(input)
    let metadata: NarrationMetadata = {
      id: options.id ?? composeId(),
      instanceId: composeId(),
      title: options.title ?? immediate?.title ?? immediate?.text?.slice(0, 100) ?? 'Narration',
      text: immediate?.text,
      source: null,
    }
    const handle = this.queue.push(async context => {
      const {signal} = context
      const reference = immediate ?? normalize(await (input as (signal: AbortSignal) => NarrationReference | Promise<NarrationReference>)(signal))
      signal.throwIfAborted()
      const update = (patch: Partial<NarrationMetadata>) => {
        metadata = {
          ...metadata,
          ...patch,
        }
        context.update(patch)
      }
      update({
        title: reference.title ?? options.title ?? reference.text?.slice(0, 100) ?? metadata.title,
        text: reference.text,
      })
      let speech: SpeechReference | undefined
      if ('audio' in reference) {
        if (reference.text) {
          speech = {text: reference.text}
        }
      } else {
        speech = reference
      }
      const native = async (error?: unknown): Promise<AudioPlayback> => {
        signal.throwIfAborted()
        if (!speech) {
          if (error === undefined) {
            throw new Error('No speech fallback is available.')
          }
          throw new Error('Narration playback failed and no speech fallback is available.', {cause: error})
        }
        if (error !== undefined) {
          this.options.onFallback?.(error)
        }
        const playback = await (this.options.createSpeech ?? browserSpeech)(speech, signal)
        // A timing belongs to the audio it was measured on, not to native speech of the same text.
        update({
          source: 'browser',
          timing: undefined,
        })
        return playback
      }
      const synthesize = speech?.synthesize === 'browser' ? undefined : speech?.synthesize ?? this.options.synthesize
      if (!('audio' in reference) && !synthesize) {
        return native()
      }
      let playback: AudioPlayback
      try {
        const {audio, timing} = 'audio' in reference ? reference : synthesized(await synthesize!(reference, signal))
        signal.throwIfAborted()
        playback = await (this.options.createAudio ? this.options.createAudio(audio, signal) : this.recording(audio, metadata.instanceId)(context))
        if (signal.aborted) {
          void playback.finished.catch(() => {})
          playback.dispose()
          signal.throwIfAborted()
        }
        update({
          source: 'audio',
          timing,
        })
      } catch (error) {
        signal.throwIfAborted()
        return native(error)
      }
      return speech ? fallbackPlayback(playback, native, signal) : playback
    }, {
      ...options,
      key: options.once === undefined ? options.key : `once:${options.once}`,
      metadata,
    })
    if (!this.observed.has(handle)) {
      this.observed.add(handle)
      const {instanceId} = metadata
      this.instances.set(instanceId, handle.id)
      void handle.finished.then(result => {
        this.instances.delete(instanceId)
        if (!this.disposed && result.status === 'completed' && options.once !== undefined) {
          this.spoken.add(options.once)
        }
        if (result.status === 'failed') {
          this.options.onError?.(result.error, metadata)
        }
      }).catch(error => {
        console.error('Narrator observer failed.', error)
      })
    }
    return handle
  }
  stop(reason?: unknown) {
    this.queue.clear(reason)
  }
  [Symbol.dispose]() {
    this.dispose()
  }
  /** The task that plays a recording: decoded through the context the audio options give, or else through a media element. */
  private recording(audio: AudioReference, instanceId: string): AudioTask<NarrationMetadata> {
    const {connect, context: through, ...options} = this.options.audio ?? {}
    const context = through?.()
    if (context) {
      return audioBuffer(audio, {
        ...options,
        context,
        connect: connect && (output => connect(output, instanceId)),
      })
    }
    return audioFile(audio, {
      ...options,
      connect: connect && (element => connect(element, instanceId)),
    })
  }
}
