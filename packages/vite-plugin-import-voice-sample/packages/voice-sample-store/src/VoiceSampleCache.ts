import type {App, ResolvedVoiceSampleRequest, VoiceSampleAudioFormat, VoiceSampleFetch, VoiceSampleMetadata, VoiceSampleTiming} from './types.ts'

import {execFile} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {promisify} from 'node:util'

import composeId from 'compose-id'
import fs from 'fs-extra'
import makeArgv from 'make-argv'
import {pack, unpack} from 'msgpackr'

import {styleVoiceSampleText} from './emotion.ts'
import {trimVoiceSample, voiceSampleTrimMinimumSilenceSeconds, voiceSampleTrimPaddingSeconds} from './trim.ts'
import {decodeCanonicalWav, encodeCanonicalWav} from './wav.ts'

const execFileAsync = promisify(execFile)
const modelDefault = 'x-ai/grok-voice-tts-1.0'
const storageSchema = 4
const conversionSchema = 1
const trimSchema = 1
const defaultSampleRate = 24_000
export const defaultVoiceSampleCooldown = 1000
const commonSampleRates = [8000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000]

export const defaultVoiceSampleBitrate = (sampleRate: number) => Math.round(0.68266 * sampleRate)

export type VoiceSampleCacheEntry = {
  audioPath: string
  metadata: VoiceSampleMetadata
  metadataPath: string
  rawPath: string
  timings: ReadonlyArray<VoiceSampleTiming>
}

type StoredVoiceSample = {
  metadata: VoiceSampleMetadata
  metadataPath: string
  rawPath: string
}

type PreparedVoiceSample = StoredVoiceSample & {
  sourceKey: string
  wavPath: string
}

const hasFile = async (file: string) => {
  try {
    const information = await fs.stat(file)
    return information.size > 0
  } catch {
    return false
  }
}
const decodeBase64 = (value: unknown) => {
  if (typeof value !== 'string' || value.length % 4 || !/^(?:[\d+/A-Za-z]{4})*(?:[\d+/A-Za-z]{2}==|[\d+/A-Za-z]{3}=)?$/u.test(value)) {
    throw new Error('OpenRouter voice synthesis returned invalid base64 audio.')
  }
  return Uint8Array.fromBase64(value)
}
const decodeTimings = (value: unknown): Array<VoiceSampleTiming> => {
  if (!value || typeof value !== 'object' || !('graph_chars' in value) || !('graph_times' in value)) {
    throw new Error('OpenRouter voice synthesis returned invalid character timings.')
  }
  const {graph_chars: characters, graph_times: times} = value
  if (!Array.isArray(characters) || !Array.isArray(times) || characters.length !== times.length) {
    throw new Error('OpenRouter voice synthesis returned mismatched character timings.')
  }
  return characters.map((char, index) => {
    const pair: unknown = times[index]
    if (!pair || typeof pair !== 'object') {
      throw new Error('OpenRouter voice synthesis returned an invalid timestamp pair.')
    }
    let start: unknown
    let end: unknown
    if (Array.isArray(pair)) {
      start = pair[0]
      end = pair[1]
    } else if ('start' in pair && 'end' in pair) {
      start = pair.start
      end = pair.end
    }
    if (typeof char !== 'string' || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      throw new Error('OpenRouter voice synthesis returned invalid character timings.')
    }
    return {
      char,
      end,
      start,
    }
  })
}
const decodeMetadata = (value: unknown): VoiceSampleMetadata => {
  if (!value || typeof value !== 'object' || !('duration' in value) || !('input' in value) || !('sampleRate' in value) || !('timings' in value) || !('voice' in value)) {
    throw new TypeError('Stored voice sample metadata is invalid.')
  }
  const {duration, input, sampleRate, timings, voice, ...rest} = value
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || typeof input !== 'string' || !input || typeof sampleRate !== 'number' || !Number.isSafeInteger(sampleRate) || sampleRate <= 0 || typeof voice !== 'string' || !voice) {
    throw new TypeError('Stored voice sample metadata is invalid.')
  }
  if (!Array.isArray(timings)) {
    throw new TypeError('Stored voice sample timings are invalid.')
  }
  const timingItems = timings as Array<unknown>
  const decodedTimings = timingItems.map(item => {
    if (!item || typeof item !== 'object' || !('char' in item) || !('start' in item) || !('end' in item)) {
      throw new TypeError('Stored voice sample timings are invalid.')
    }
    const {char, start, end} = item
    if (typeof char !== 'string' || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > duration + 0.02) {
      throw new TypeError('Stored voice sample timings are invalid.')
    }
    return {
      char,
      end,
      start,
    }
  })
  const traceId = 'traceId' in rest ? rest.traceId : undefined
  if (traceId !== undefined && typeof traceId !== 'string') {
    throw new TypeError('Stored voice sample trace ID is invalid.')
  }
  const trim = 'trim' in rest ? rest.trim : undefined
  if (trim !== undefined) {
    if (
      !trim
      || typeof trim !== 'object'
      || !('changed' in trim)
      || !('minimumSilenceSeconds' in trim)
      || !('paddingSeconds' in trim)
      || !('removedEndSeconds' in trim)
      || !('removedStartSeconds' in trim)
      || !('sourceDuration' in trim)
      || !('thresholdDb' in trim)
      || typeof trim.changed !== 'boolean'
      || typeof trim.minimumSilenceSeconds !== 'number'
      || typeof trim.paddingSeconds !== 'number'
      || typeof trim.removedEndSeconds !== 'number'
      || typeof trim.removedStartSeconds !== 'number'
      || typeof trim.sourceDuration !== 'number'
      || typeof trim.thresholdDb !== 'number'
      || !Number.isFinite(trim.minimumSilenceSeconds)
      || !Number.isFinite(trim.paddingSeconds)
      || !Number.isFinite(trim.removedEndSeconds)
      || !Number.isFinite(trim.removedStartSeconds)
      || !Number.isFinite(trim.sourceDuration)
      || !Number.isFinite(trim.thresholdDb)
      || trim.minimumSilenceSeconds < 0
      || trim.paddingSeconds < 0
      || trim.removedEndSeconds < 0
      || trim.removedStartSeconds < 0
      || trim.sourceDuration < duration
      || trim.thresholdDb > 0
    ) {
      throw new TypeError('Stored voice sample trim metadata is invalid.')
    }
  }
  return {
    duration,
    input,
    sampleRate,
    timings: decodedTimings,
    voice,
    ...traceId ? {traceId} : {},
    ...trim ? {trim: trim as VoiceSampleMetadata['trim']} : {},
  }
}
const decodeEnvelope = (value: unknown, requestedSampleRate: number, input: string, voice: string, traceId?: string) => {
  if (!value || typeof value !== 'object' || !('audio' in value) || !('duration' in value) || !('content_type' in value) || !('audio_timestamps' in value) || typeof value.content_type !== 'string' || !/^audio\/pcm(?:;|$)/iu.test(value.content_type) || typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration <= 0) {
    throw new Error('OpenRouter voice synthesis returned an invalid timed PCM envelope.')
  }
  const pcm = decodeBase64(value.audio)
  if (!pcm.byteLength || pcm.byteLength % 2) {
    throw new Error('OpenRouter voice synthesis returned invalid 16-bit PCM.')
  }
  const duration = value.duration
  const inferredRate = pcm.byteLength / 2 / duration
  const sampleRates = [...new Set([...commonSampleRates, requestedSampleRate])]
  const sampleRate = sampleRates.toSorted((a, b) => Math.abs(a - inferredRate) - Math.abs(b - inferredRate))[0]
  if (Math.abs(pcm.byteLength / 2 / sampleRate - duration) > 0.015) {
    throw new Error('OpenRouter PCM length and duration do not establish a supported sample rate.')
  }
  const timings = decodeTimings(value.audio_timestamps)
  if (timings.some(timing => timing.end > duration + 0.02)) {
    throw new Error('OpenRouter character timing exceeds the audio duration.')
  }
  const metadata: VoiceSampleMetadata = {
    duration,
    input,
    sampleRate,
    timings,
    voice,
    ...traceId ? {traceId} : {},
  }
  return {
    metadata,
    pcm,
  }
}

export type VoiceSampleCacheOptions = {
  apiKey?: string
  app: App
  bitrate?: number
  cacheFolder: string
  cooldown: number
  fetch?: VoiceSampleFetch
  ffmpegPath?: string
  model?: string
  sampleRate?: number
  storageFolder: string
}

export default class VoiceSampleCache {
  readonly #apiKey?: string
  readonly #app: App
  readonly #bitrate: number
  readonly #cacheFolder: string
  readonly #cooldown: number
  readonly #fetch: VoiceSampleFetch
  readonly #ffmpegPath: string
  #lastRequestStartedAt = 0
  readonly #model: string
  readonly #pendingConversions = new Map<string, Promise<string>>
  readonly #pendingStores = new Map<string, Promise<StoredVoiceSample>>
  readonly #pendingTrims = new Map<string, Promise<PreparedVoiceSample>>
  #requestQueue: Promise<void> = Promise.resolve()
  readonly #sampleRate: number
  readonly #storageFolder: string

  constructor(options: VoiceSampleCacheOptions) {
    this.#apiKey = options.apiKey
    this.#app = options.app
    this.#sampleRate = options.sampleRate ?? defaultSampleRate
    if (!Number.isSafeInteger(this.#sampleRate) || this.#sampleRate <= 0) {
      throw new TypeError('Voice sample sampleRate must be a positive integer.')
    }
    this.#bitrate = options.bitrate ?? defaultVoiceSampleBitrate(this.#sampleRate)
    if (!Number.isSafeInteger(this.#bitrate) || this.#bitrate <= 0) {
      throw new TypeError('Voice sample bitrate must be a positive integer.')
    }
    this.#storageFolder = options.storageFolder
    this.#cacheFolder = options.cacheFolder
    this.#cooldown = options.cooldown
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#ffmpegPath = options.ffmpegPath ?? 'ffmpeg'
    this.#model = options.model ?? modelDefault
  }

  cacheKey(key: string, format: Exclude<VoiceSampleAudioFormat, 'wav'>) {
    if (format === 'pcm') {
      return key
    }
    return createHash('sha256').update(JSON.stringify({
      bitrate: this.#bitrate,
      conversionSchema,
      format,
      source: key,
    })).digest('hex')
  }

  async getAudio(request: ResolvedVoiceSampleRequest & {format: VoiceSampleAudioFormat}): Promise<VoiceSampleCacheEntry> {
    const key = this.key(request)
    const stored = await this.#getStored(request, key)
    const prepared = await this.#prepare(request, key, stored)
    const audioPath = await this.#getAudio(request.format, prepared.sourceKey, prepared.wavPath)
    return {
      audioPath,
      metadata: prepared.metadata,
      metadataPath: prepared.metadataPath,
      rawPath: stored.rawPath,
      timings: prepared.metadata.timings,
    }
  }

  async getTimings(request: ResolvedVoiceSampleRequest) {
    const key = this.key(request)
    const stored = await this.#getStored(request, key)
    const prepared = await this.#prepare(request, key, stored)
    return {
      metadata: prepared.metadata,
      metadataPath: prepared.metadataPath,
      rawPath: stored.rawPath,
      timings: prepared.metadata.timings,
    }
  }

  key(request: ResolvedVoiceSampleRequest) {
    const synthesis = {
      language: request.language,
      text: request.text,
      voice: request.voice,
      ...request.emotion ? {emotion: request.emotion} : {},
    }
    return createHash('sha256').update(JSON.stringify({
      model: this.#model,
      sampleRate: this.#sampleRate,
      storageSchema,
      synthesis,
    })).digest('hex')
  }

  metadataPath(key: string) {
    return resolve(this.#storageFolder, `${key}.msgpack`)
  }

  rawPath(key: string) {
    return resolve(this.#storageFolder, `${key}.wav`)
  }

  trimKey(key: string, trimThreshold: number) {
    return createHash('sha256').update(JSON.stringify({
      minimumSilenceSeconds: voiceSampleTrimMinimumSilenceSeconds,
      trimSchema,
      paddingSeconds: voiceSampleTrimPaddingSeconds,
      source: key,
      trimThreshold,
    })).digest('hex')
  }

  #cachePath(key: string, format: Exclude<VoiceSampleAudioFormat, 'wav'>) {
    return resolve(this.#cacheFolder, `${this.cacheKey(key, format)}.${format}`)
  }

  async #convert(format: Exclude<VoiceSampleAudioFormat, 'wav'>, key: string, rawPath: string) {
    const output = this.#cachePath(key, format)
    if (await hasFile(output)) {
      return output
    }
    await fs.ensureDir(this.#cacheFolder)
    const token = `${process.pid}-${composeId()}`
    const temporary = `${output}.${token}.tmp`
    try {
      if (format === 'opus') {
        const argv = makeArgv({
          hide_banner: true,
          loglevel: 'error',
          i: rawPath,
          map: '0:a:0',
          'c:a': 'libopus',
          'b:a': this.#bitrate,
          vbr: 'on',
          compression_level: 10,
          application: 'audio',
          f: 'opus',
          y: true,
        }, {
          prefix: '-',
          keyStyle: false,
        })
        await execFileAsync(this.#ffmpegPath, [...argv, temporary])
      } else {
        const wav = new Uint8Array(await fs.readFile(rawPath))
        await fs.writeFile(temporary, decodeCanonicalWav(wav).pcm)
      }
      if (!await hasFile(temporary)) {
        throw new Error(`Voice sample conversion did not produce a valid .${format} file.`)
      }
      if (await hasFile(output)) {
        return output
      }
      try {
        await fs.rename(temporary, output)
      } catch (error) {
        if (!await hasFile(output)) {
          throw error
        }
      }
      return output
    } finally {
      await fs.remove(temporary)
    }
  }

  async #generateStored(request: ResolvedVoiceSampleRequest, key: string): Promise<StoredVoiceSample> {
    if (!this.#apiKey) {
      throw new Error('OPENROUTER_API_KEY is required to generate an uncached voice sample.')
    }
    await fs.ensureDir(this.#storageFolder)
    const input = styleVoiceSampleText(request.text, request.emotion)
    await this.#waitForRequestSlot()
    const response = await this.#fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.#app.url,
        'X-OpenRouter-Title': this.#app.title,
        'X-OpenRouter-Cache': 'true',
        'X-OpenRouter-Cache-TTL': '86400',
      },
      body: JSON.stringify({
        model: this.#model,
        input,
        voice: request.voice,
        response_format: 'pcm',
        provider: {
          options: {
            xai: {
              language: request.language,
              optimize_streaming_latency: 0,
              output_format: {
                codec: 'pcm',
                sample_rate: this.#sampleRate,
              },
              with_timestamps: true,
            },
          },
        },
      }),
    })
    if (!response.ok) {
      const responseText = await response.text()
      const detail = responseText.slice(0, 1000)
      throw new Error(`OpenRouter voice synthesis failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}.`)
    }
    const {metadata, pcm} = decodeEnvelope(await response.json(), this.#sampleRate, input, request.voice, response.headers.get('x-generation-id') ?? undefined)
    const wav = encodeCanonicalWav(pcm, metadata.sampleRate)
    const rawPath = this.rawPath(key)
    const metadataPath = this.metadataPath(key)
    const token = `${process.pid}-${composeId()}`
    const temporaryRaw = `${rawPath}.${token}.tmp`
    const temporaryMetadata = `${metadataPath}.${token}.tmp`
    try {
      await fs.writeFile(temporaryRaw, wav)
      await fs.writeFile(temporaryMetadata, pack(metadata))
      if (!await hasFile(temporaryRaw) || !await hasFile(temporaryMetadata)) {
        throw new Error('Voice sample generation did not produce a valid raw store entry.')
      }
      const raced = await this.#readStored(key)
      if (raced) {
        return raced
      }
      await fs.remove(rawPath)
      await fs.remove(metadataPath)
      await fs.rename(temporaryRaw, rawPath)
      await fs.rename(temporaryMetadata, metadataPath)
      return {
        metadata,
        metadataPath,
        rawPath,
      }
    } finally {
      await fs.remove(temporaryRaw)
      await fs.remove(temporaryMetadata)
    }
  }
  async #getAudio(format: VoiceSampleAudioFormat, key: string, rawPath: string) {
    if (format === 'wav') {
      return rawPath
    }
    const pendingKey = `${key}:${format}`
    const existing = this.#pendingConversions.get(pendingKey)
    if (existing) {
      return existing
    }
    const pending = this.#convert(format, key, rawPath)
    this.#pendingConversions.set(pendingKey, pending)
    try {
      return await pending
    } finally {
      this.#pendingConversions.delete(pendingKey)
    }
  }
  async #getStored(request: ResolvedVoiceSampleRequest, key: string) {
    const cached = await this.#readStored(key)
    if (cached) {
      return cached
    }
    const existing = this.#pendingStores.get(key)
    if (existing) {
      return existing
    }
    const pending = this.#generateStored(request, key)
    this.#pendingStores.set(key, pending)
    try {
      return await pending
    } finally {
      this.#pendingStores.delete(key)
    }
  }

  async #prepare(request: ResolvedVoiceSampleRequest, key: string, stored: StoredVoiceSample): Promise<PreparedVoiceSample> {
    if (!request.trim) {
      return {
        ...stored,
        sourceKey: key,
        wavPath: stored.rawPath,
      }
    }
    const sourceKey = this.trimKey(key, request.trimThreshold)
    const cached = await this.#readPrepared(sourceKey, stored.rawPath)
    if (cached) {
      return cached
    }
    const existing = this.#pendingTrims.get(sourceKey)
    if (existing) {
      return existing
    }
    const pending = this.#trimStored(stored, sourceKey, request.trimThreshold)
    this.#pendingTrims.set(sourceKey, pending)
    try {
      return await pending
    } finally {
      this.#pendingTrims.delete(sourceKey)
    }
  }

  async #readPrepared(sourceKey: string, rawPath: string): Promise<PreparedVoiceSample | undefined> {
    const wavPath = resolve(this.#cacheFolder, `${sourceKey}.wav`)
    const metadataPath = resolve(this.#cacheFolder, `${sourceKey}.msgpack`)
    if (!await hasFile(wavPath) || !await hasFile(metadataPath)) {
      return
    }
    return {
      metadata: decodeMetadata(unpack(await fs.readFile(metadataPath)) as unknown),
      metadataPath,
      rawPath,
      sourceKey,
      wavPath,
    }
  }

  async #readStored(key: string): Promise<StoredVoiceSample | undefined> {
    const rawPath = this.rawPath(key)
    const metadataPath = this.metadataPath(key)
    if (!await hasFile(rawPath) || !await hasFile(metadataPath)) {
      return
    }
    const metadata = decodeMetadata(unpack(await fs.readFile(metadataPath)) as unknown)
    return {
      metadata,
      metadataPath,
      rawPath,
    }
  }

  async #trimStored(stored: StoredVoiceSample, sourceKey: string, trimThreshold: number): Promise<PreparedVoiceSample> {
    await fs.ensureDir(this.#cacheFolder)
    const wavPath = resolve(this.#cacheFolder, `${sourceKey}.wav`)
    const metadataPath = resolve(this.#cacheFolder, `${sourceKey}.msgpack`)
    const token = `${process.pid}-${composeId()}`
    const temporaryWav = `${wavPath}.${token}.tmp`
    const temporaryMetadata = `${metadataPath}.${token}.tmp`
    try {
      const trimmed = trimVoiceSample(new Uint8Array(await fs.readFile(stored.rawPath)), stored.metadata, trimThreshold)
      await fs.writeFile(temporaryWav, trimmed.wav)
      await fs.writeFile(temporaryMetadata, pack(trimmed.metadata))
      if (!await hasFile(temporaryWav) || !await hasFile(temporaryMetadata)) {
        throw new Error('Voice sample trimming did not produce a valid cached derivative.')
      }
      const raced = await this.#readPrepared(sourceKey, stored.rawPath)
      if (raced) {
        return raced
      }
      await fs.remove(wavPath)
      await fs.remove(metadataPath)
      await fs.rename(temporaryWav, wavPath)
      await fs.rename(temporaryMetadata, metadataPath)
      return {
        metadata: trimmed.metadata,
        metadataPath,
        rawPath: stored.rawPath,
        sourceKey,
        wavPath,
      }
    } finally {
      await fs.remove(temporaryWav)
      await fs.remove(temporaryMetadata)
    }
  }

  async #waitForRequestSlot() {
    const previous = this.#requestQueue
    const {promise, resolve: release} = Promise.withResolvers<void>()
    this.#requestQueue = promise
    await previous
    try {
      const delay = this.#lastRequestStartedAt + this.#cooldown - Date.now()
      if (delay > 0) {
        await sleep(delay)
      }
      this.#lastRequestStartedAt = Date.now()
    } finally {
      release()
    }
  }
}
