import type {Mood} from '../../src/moods/index.ts'

import {moods} from '../../src/moods/index.ts'

const rate = 48_000
const effectsGain = 0.6 * 10 ** (12 / 20)
/** how often the offline render pauses for the loop’s scheduler, in seconds of audio; shorter than its lookahead, so no window goes unscheduled */
const step = 0.2
/** milliseconds of real time each pause lasts, enough for the scheduler’s interval to fire */
const pause = 100
const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}
/**
 * Renders the loop of every mood, those of the rooms too, offline on the effects master as the game plays it – fading in, held, then let go – and checks it for silence, headroom and a silent tail. No audible output, DOM, input, focus or viewport changes.
 * With `listen`, every result carries its render as a base64 WAV.
 */
export default async function verify({listen = false, seconds = 20}: {
  listen?: boolean
  /** how long each mood holds before it is let go */
  seconds?: number
} = {}) {
  const results = []
  for (const mood of Object.values<Mood>(moods)) {
    const {ambience: Ambience} = mood
    if (!Ambience) {
      continue
    }
    const end = seconds + 2
    const context = new OfflineAudioContext(2, Math.ceil(rate * end), rate)
    const master = context.createGain()
    master.gain.value = effectsGain
    master.connect(context.destination)
    const loop = new Ambience
    const failures: Array<unknown> = []
    for (let time = 0; time < end; time += step) {
      const moment = time
      context.suspend(moment).then(async () => {
        if (moment === 0) {
          loop.setLevel(0, 0)
          loop.start({
            context,
            master,
          })
          loop.setLevel(1, 0.4)
        } else if (moment >= seconds && loop.playing) {
          loop.setLevel(0, 0.4)
          loop.stop(1.5)
        }
        await new Promise(resolve => {
          setTimeout(resolve, pause)
        })
        return context.resume()
      }).catch((error: unknown) => failures.push(error))
    }
    const buffer = await context.startRendering()
    assert(!failures.length, `${mood.title}’s timeline failed: ${String(failures[0])}`)
    let peak = 0
    let power = 0
    let tail = 0
    const heldFrom = Math.ceil(2 * rate)
    const heldUntil = Math.floor(seconds * rate)
    const tailStart = Math.ceil((end - 0.2) * rate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const [index, sample] of buffer.getChannelData(channel).entries()) {
        assert(Number.isFinite(sample), `${mood.title} rendered a nonfinite sample`)
        peak = Math.max(peak, Math.abs(sample))
        if (index >= heldFrom && index < heldUntil) {
          power += sample * sample
        }
        if (index >= tailStart) {
          tail = Math.max(tail, Math.abs(sample))
        }
      }
    }
    const rms = Math.sqrt(power / (heldUntil - heldFrom) / buffer.numberOfChannels)
    assert(rms > 0.001, `${mood.title} is close to silent: ${rms}`)
    assert(peak < 0.9, `${mood.title} exceeded headroom with ${peak}`)
    assert(tail < 0.0005, `${mood.title} did not finish silently: ${tail}`)
    results.push({
      mood: mood.id,
      seconds: Number(buffer.duration.toFixed(2)),
      peak: Number(peak.toFixed(4)),
      rms: Number(rms.toFixed(5)),
      tail: Number(tail.toFixed(6)),
      ...listen ? {wav: wav(buffer)} : {},
    })
  }
  return results
}
/** 16-bit stereo WAV of the buffer, for listening to a render. */
function wav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const bytes = new DataView(new ArrayBuffer(44 + frames * channels * 2))
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      bytes.setUint8(offset + index, value.codePointAt(index)!)
    }
  }
  text(0, 'RIFF')
  bytes.setUint32(4, 36 + frames * channels * 2, true)
  text(8, 'WAVEfmt ')
  bytes.setUint32(16, 16, true)
  bytes.setUint16(20, 1, true)
  bytes.setUint16(22, channels, true)
  bytes.setUint32(24, rate, true)
  bytes.setUint32(28, rate * channels * 2, true)
  bytes.setUint16(32, channels * 2, true)
  bytes.setUint16(34, 16, true)
  text(36, 'data')
  bytes.setUint32(40, frames * channels * 2, true)
  const data = Array.from({length: channels}, (_, channel) => buffer.getChannelData(channel))
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      bytes.setInt16(44 + (frame * channels + channel) * 2, Math.max(-1, Math.min(1, data[channel][frame])) * 32_767, true)
    }
  }
  const encoded = new Uint8Array(bytes.buffer)
  return encoded.toBase64()
}
