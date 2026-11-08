import type {AudioFileOptions, AudioReference} from 'use-audio-queue/browser'
import type {AudioPlayback, AudioPushOptions, AudioQueueOptions} from 'use-audio-queue/core'

export type {AudioReference} from 'use-audio-queue/browser'
export type {AudioHandle, AudioPriority, AudioProgress, AudioResult} from 'use-audio-queue/core'
/** a word of a narration’s text: its character range in the text and when it is spoken, in seconds of the audio */
export type NarrationWord = {
  end: number
  /** index of the word’s first character */
  from: number
  start: number
  /** index after the word’s last character */
  to: number
}
/**
 * When the words of a narration’s text are spoken. `words` holds every whitespace-separated word of the text, in order (see `narrationWords`).
 * `characters`, when known, holds one span per character of the text, `null` for characters without their own, like spaces and punctuation.
 */
export type NarrationTiming = {
  characters?: ReadonlyArray<readonly [start: number, end: number] | null>
  words: ReadonlyArray<NarrationWord>
}
/** a word as speech-to-text recognized it, in its own spelling */
export type RecognizedWord = {
  end: number
  start: number
  word: string
}
export type SpeechReference = {
  lang?: string
  pitch?: number
  rate?: number
  /** Override the narrator's provider. 'browser' explicitly avoids remote generation. */
  synthesize?: SpeechSynthesizer | 'browser'
  text: string
  title?: string
  voice?: string
}
export type RecordingReference = {
  audio: AudioReference
  /** Used for readable UI metadata and as browser speech on recording failure. */
  text?: string
  /** when the words of `text` are spoken in `audio` */
  timing?: NarrationTiming
  title?: string
}
/** A bare string is spoken text. Use {audio: '/voice.opus'} for a string URL. */
export type NarrationReference = Blob | RecordingReference | SpeechReference | URL | string
export type NarrationInput = ((signal: AbortSignal) => NarrationReference | Promise<NarrationReference>) | NarrationReference
/** generated audio along with when the speech’s words are spoken in it */
export type SynthesizedSpeech = {
  audio: AudioReference
  timing?: NarrationTiming
}
export type SpeechSynthesizer = (speech: SpeechReference, signal: AbortSignal) => AudioReference | Promise<AudioReference | SynthesizedSpeech> | SynthesizedSpeech
export type NarrationMetadata = {
  id: string
  /** Unique per accepted narration instance; suitable for UI keys and per-playback instrumentation. */
  instanceId: string
  source: 'audio' | 'browser' | null
  text?: string
  /** when the words of `text` are spoken, while the narration plays audio that has a timing */
  timing?: NarrationTiming
  title: string
}
export type NarrationPushOptions = Omit<AudioPushOptions<NarrationMetadata>, 'metadata'> & {
  id?: string
  /** Session-local completion memory, plus deduplication while unfinished. */
  once?: string
  /** Replay a remembered entry, retaining its completion memory and in-flight deduplication. */
  repeat?: boolean
  title?: string
}
export type NarratorAudioOptions = Omit<AudioFileOptions, 'connect'> & {
  /** Owns only this connection: the recording’s media element, or the node its decoded audio leaves where `context` gives a context. */
  connect?: (audio: AudioNode | HTMLAudioElement, instanceId: string) => () => void
  /** The audio context to play recordings through as decoded buffers (see `audioBuffer`) instead of media elements, asked for every recording; recordings play through media elements whenever it gives none. For contexts that can’t take media elements, like an offline one rendering a film. */
  context?: () => BaseAudioContext | undefined
}
export type NarratorOptions = AudioQueueOptions & {
  audio?: NarratorAudioOptions
  /** Injectable transports keep the controller usable outside browsers and testable without sound. */
  createAudio?: (reference: AudioReference, signal: AbortSignal) => AudioPlayback | Promise<AudioPlayback>
  createSpeech?: (speech: SpeechReference, signal: AbortSignal) => AudioPlayback | Promise<AudioPlayback>
  enabled?: boolean
  onError?: (error: unknown, metadata: NarrationMetadata) => void
  onFallback?: (error: unknown) => void
  synthesize?: SpeechSynthesizer
}

export type NarrationState = NarrationMetadata & {
  status: 'after' | 'before' | 'playing' | 'preparing'
  /** Monotonic deadline for a timed before/after phase. */
  statusEndsAt?: number
}
