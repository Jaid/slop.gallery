import type {VoiceSampleMetadata, VoiceSampleTrimMetadata} from './types.ts'

import {decodeCanonicalWav, encodeCanonicalWav} from './wav.ts'

export const defaultVoiceSampleTrimThreshold = -50
export const voiceSampleTrimMinimumSilenceSeconds = 0.02
export const voiceSampleTrimPaddingSeconds = 0.01

export const trimVoiceSample = (wav: Uint8Array, metadata: VoiceSampleMetadata, thresholdDb: number) => {
  if (!Number.isFinite(thresholdDb) || thresholdDb > 0) {
    throw new TypeError('Voice sample trimThreshold must be a finite dBFS value at or below 0.')
  }
  const {pcm} = decodeCanonicalWav(wav, metadata.sampleRate)
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const loudness = (sample: number) => Math.abs(view.getInt16(sample * 2, true))
  const samples = pcm.byteLength / 2
  const threshold = 32_768 * 10 ** (thresholdDb / 20)
  let first = 0
  let end = samples
  while (first < samples && loudness(first) < threshold) {
    first++
  }
  if (first === samples) {
    throw new Error('Voice sample is entirely below the trim threshold.')
  }
  while (end > first && loudness(end - 1) < threshold) {
    end--
  }
  const padding = Math.round(metadata.sampleRate * voiceSampleTrimPaddingSeconds)
  const minimumSilence = Math.ceil(metadata.sampleRate * voiceSampleTrimMinimumSilenceSeconds)
  const startSample = first >= minimumSilence ? Math.max(0, first - padding) : 0
  const endSample = samples - end >= minimumSilence ? Math.min(samples, end + padding) : samples
  const sourceDuration = samples / metadata.sampleRate
  const removedStartSeconds = startSample / metadata.sampleRate
  const removedEndSeconds = (samples - endSample) / metadata.sampleRate
  const duration = (endSample - startSample) / metadata.sampleRate
  const changed = startSample !== 0 || endSample !== samples
  const shift = (time: number) => Math.min(duration, Math.max(0, time - removedStartSeconds))
  const trim: VoiceSampleTrimMetadata = {
    changed,
    minimumSilenceSeconds: voiceSampleTrimMinimumSilenceSeconds,
    paddingSeconds: voiceSampleTrimPaddingSeconds,
    removedEndSeconds,
    removedStartSeconds,
    sourceDuration,
    thresholdDb,
  }
  const trimmedMetadata: VoiceSampleMetadata = {
    duration,
    input: metadata.input,
    sampleRate: metadata.sampleRate,
    timings: metadata.timings.map(timing => ({
      char: timing.char,
      end: shift(timing.end),
      start: shift(timing.start),
    })),
    trim,
    voice: metadata.voice,
    ...metadata.traceId ? {traceId: metadata.traceId} : {},
  }
  const trimmedWav = changed ? encodeCanonicalWav(pcm.subarray(startSample * 2, endSample * 2), metadata.sampleRate) : Uint8Array.from(wav)
  return {
    metadata: trimmedMetadata,
    wav: trimmedWav,
  }
}
