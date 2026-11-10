import type {Hearing, Position} from './hearing.ts'
import type {Voice} from './voices.ts'

import {hearingPath} from './hearing.ts'

/** where sound goes: a node of a context, live or offline */
export type AudioOutput = {
  context: BaseAudioContext
  master: AudioNode
}
export type Playback = {
  /** the level of the whole playback, 1 unless {@link PlayVoicesOptions.gain} said otherwise */
  gain: AudioParam
  /** Fades the playback out within `fade` seconds, by default 0.025, and releases its nodes. */
  stop: (fade?: number) => void
}
export type PlayVoicesOptions = {
  /** Fits the entire recipe, including delays, to this duration in seconds. */
  duration?: number
  gain?: number
  /** how far the sound carries from its {@link position}, by default at full level within 2 m and silent from 26 m on */
  hearing?: Hearing
  /** Called once every voice has ended and the playback released its nodes. */
  onEnded?: () => void
  /** where the sound is heard from, through an HRTF panner and with the air taking its highs by where the listener stands as it starts; without one it plays right where the listener is */
  position?: Position
  /** what the noise of the recipe is made from: the same seed makes the same noise, another one tells two sounds of the same recipe apart */
  seed?: string
  /** Holds the envelopes and loops the noise until the playback is stopped. */
  sustain?: boolean
}

const defaultHearing: Hearing = {
  near: 2,
  far: 26,
}
const silence = 0.00001
const fillNoise = (data: Float32Array, seed: string) => {
  let state = 2_166_136_261
  for (const character of seed) {
    state = Math.imul(state ^ character.codePointAt(0)!, 16_777_619) >>> 0
  }
  for (let i = 0; i < data.length; i++) {
    state = Math.imul(state, 1_664_525) + 1_013_904_223 >>> 0
    data[i] = state / 2_147_483_648 - 1
  }
}

/**
 * Plays a recipe of voices from now on. The same graph runs live or offline, and the same recipe with the same seed sounds the same.
 * A playback owns all of its nodes and releases them once it has ended or was stopped; it never touches the output.
 */
export default function playVoices({context, master}: AudioOutput, voices: ReadonlyArray<Voice>, {duration, gain = 1, hearing = defaultHearing, onEnded, position, seed = '', sustain = false}: PlayVoicesOptions = {}): Playback {
  const path = position && hearingPath(context, position, hearing)
  path?.absorption.connect(master)
  const bus = context.createGain()
  bus.gain.value = gain
  bus.connect(path?.panner ?? master)
  const length = Math.max(...voices.map(voice => (voice.delay ?? 0) + voice.duration))
  const scale = duration === undefined ? 1 : Math.max(0.01, duration) / length
  const sources = new Set<AudioScheduledSourceNode>
  const now = context.currentTime
  for (const [index, voice] of voices.entries()) {
    const start = now + (voice.delay ?? 0) * scale
    const voiceDuration = voice.duration * scale
    const end = start + voiceDuration
    const attack = Math.min((voice.attack ?? 0.003) * scale, voiceDuration * 0.8)
    const envelope = context.createGain()
    // Source start and automation can round to adjacent samples; silence must precede onset.
    envelope.gain.value = 0
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(voice.volume, start + attack)
    if (!sustain) {
      envelope.gain.exponentialRampToValueAtTime(silence, end)
      envelope.gain.setValueAtTime(0, end)
    }
    const filter = voice.filter ? context.createBiquadFilter() : undefined
    if (filter && voice.filter) {
      filter.type = voice.filter.type
      filter.Q.value = voice.filter.q ?? 1
      filter.frequency.setValueAtTime(voice.filter.frequency, start)
      if (voice.filter.endFrequency) {
        filter.frequency.exponentialRampToValueAtTime(voice.filter.endFrequency, end)
      }
      filter.connect(envelope)
    }
    envelope.connect(bus)
    let source: AudioScheduledSourceNode
    if (voice.kind === 'oscillator') {
      const oscillator = context.createOscillator()
      oscillator.type = voice.type ?? 'sine'
      oscillator.frequency.setValueAtTime(voice.frequency, start)
      if (voice.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, end)
      }
      source = oscillator
    } else {
      const buffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * voiceDuration)), context.sampleRate)
      fillNoise(buffer.getChannelData(0), `${seed}:${index}`)
      const noiseSource = context.createBufferSource()
      noiseSource.buffer = buffer
      noiseSource.loop = sustain
      source = noiseSource
    }
    source.connect(filter ?? envelope)
    sources.add(source)
    source.addEventListener('ended', () => {
      source.disconnect()
      filter?.disconnect()
      envelope.disconnect()
      sources.delete(source)
      if (!sources.size) {
        bus.disconnect()
        path?.panner.disconnect()
        path?.absorption.disconnect()
        onEnded?.()
      }
    }, {once: true})
    source.start(start)
    if (!sustain) {
      source.stop(end)
    }
  }
  let stopped = false
  return {
    gain: bus.gain,
    stop(fade = 0.025) {
      if (stopped || !sources.size) {
        return
      }
      stopped = true
      const stopTime = context.currentTime
      bus.gain.cancelAndHoldAtTime(stopTime)
      bus.gain.linearRampToValueAtTime(0, stopTime + fade)
      for (const source of sources) {
        source.stop(stopTime + fade)
      }
    },
  }
}
