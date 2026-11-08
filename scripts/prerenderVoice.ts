import type {VoiceSampleFetch} from 'voice-sample-store'

import {parseArgs} from 'node:util'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import getFree from 'get-free'
import VoiceSampleStore from 'voice-sample-store'

export type PrerenderVoiceOptions = {
  apiKey?: string
  bitrate?: number
  fetch?: VoiceSampleFetch
  folder?: string
  input: string
  output?: string
  rootFolder?: string
  sampleRate?: number
  trim?: boolean
  trimThreshold?: number
}

const help = [
  'Usage: bun scripts/prerenderVoice.ts --input <string> [--output <file.opus>] [--bitrate <bits-per-second>] [--sample-rate <hz>] [--trim | --no-trim] [--trim-threshold=<dBFS>]',
  '',
  'Prepares a cached Iris sample through voice-sample-store and publishes a collision-safe Opus copy.',
  'Defaults match the shared store: 24 kHz synthesis, derived Opus bitrate, trimming enabled at -50 dBFS.',
].join('\n')
const optionalNumber = (value: string | undefined, name: string) => {
  if (value === undefined) {
    return
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new TypeError(`${name} must be finite.`)
  }
  return number
}
const reserveOutput = async (requested: string) => {
  const parsed = path.parse(requested)
  await fs.ensureDir(parsed.dir)
  const free = await getFree(parsed.name, async candidate => {
    const output = path.join(parsed.dir, candidate + parsed.ext)
    if (await fs.pathExists(output)) {
      return true
    }
    const lock = `${output}.lock`
    try {
      await fs.writeFile(lock, '', {flag: 'wx'})
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        return true
      }
      throw error
    }
    if (await fs.pathExists(output)) {
      await fs.remove(lock)
      return true
    }
    return false
  })
  return path.join(parsed.dir, free + parsed.ext)
}

export function parsePrerenderVoiceArgs(args: Array<string>) {
  const parsed = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    allowNegative: true,
    options: {
      input: {type: 'string'},
      bitrate: {type: 'string'},
      output: {type: 'string'},
      'sample-rate': {type: 'string'},
      trim: {
        type: 'boolean',
        default: true,
      },
      'trim-threshold': {type: 'string'},
      help: {type: 'boolean'},
    },
  })
  if (parsed.values.help) {
    return
  }
  if (parsed.values.input === undefined) {
    throw new Error('--input is required.')
  }
  const bitrate = optionalNumber(parsed.values.bitrate, 'bitrate')
  if (bitrate !== undefined && (!Number.isSafeInteger(bitrate) || bitrate <= 0)) {
    throw new TypeError('bitrate must be a positive integer.')
  }
  const sampleRate = optionalNumber(parsed.values['sample-rate'], 'sample-rate')
  if (sampleRate !== undefined && (!Number.isSafeInteger(sampleRate) || sampleRate <= 0)) {
    throw new TypeError('sample-rate must be a positive integer.')
  }
  const trimThreshold = optionalNumber(parsed.values['trim-threshold'], 'trim-threshold')
  if (trimThreshold !== undefined && trimThreshold > 0) {
    throw new TypeError('trim-threshold must be at or below 0 dBFS.')
  }
  return {
    bitrate,
    input: parsed.values.input,
    output: parsed.values.output,
    sampleRate,
    trim: parsed.values.trim,
    trimThreshold,
  }
}

const main = async ({
  apiKey = Bun.env.OPENROUTER_API_KEY,
  bitrate,
  fetch,
  folder = 'private/prerender-voice',
  input,
  output,
  rootFolder = path.resolve(import.meta.dir, '..'),
  sampleRate,
  trim = true,
  trimThreshold,
}: PrerenderVoiceOptions) => {
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('Input must be a nonempty string.')
  }
  const requested = path.resolve(rootFolder, output ?? 'private/prerender-voice/voice.opus')
  if (path.extname(requested).toLowerCase() !== '.opus') {
    throw new Error('Output must have an .opus extension.')
  }
  const store = new VoiceSampleStore({
    rootFolder,
    apiKey,
    app: {
      title: 'Slop Gallery',
      url: 'https://slop.gallery',
    },
    bitrate,
    fetch,
    folder,
    sampleRate,
    trim,
    trimThreshold,
  })
  const prepared = await store.prepare({
    text: input,
    emotion: 'loud',
    format: 'opus',
    language: 'en',
    trim,
    trimThreshold,
    voice: 'iris',
  })
  const destination = await reserveOutput(requested)
  try {
    await fs.copyFile(prepared.path, destination, fs.constants.COPYFILE_EXCL)
  } finally {
    await fs.remove(`${destination}.lock`)
  }
  return {
    output: destination,
    duration: prepared.metadata.duration,
    metadataPath: prepared.metadataPath,
    rawPath: prepared.rawPath,
    sampleRate: prepared.metadata.sampleRate,
    timings: prepared.metadata.timings,
    trim: prepared.metadata.trim,
  }
}

export default main

if (import.meta.main) {
  const options = parsePrerenderVoiceArgs(Bun.argv.slice(2))
  if (options) {
    console.log(JSON.stringify(await main(options), null, 2))
  } else {
    console.log(help)
  }
}
