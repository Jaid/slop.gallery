import type {OpenRouterAccess} from './openRouterAccess.ts'

import pcmWave from '../audio/pcmWave.ts'
import ExternalGenerator from './ExternalGenerator.ts'

export default class NarrationGenerator extends ExternalGenerator {
  constructor(access: OpenRouterAccess, readonly model: string, readonly voice: string) {
    super(access)
  }

  async generate(input: string, {signal, format = this.model.startsWith('google/gemini-') ? 'pcm' : 'mp3', character, providerOptions}: {
    character?: string
    format?: 'mp3' | 'pcm'
    providerOptions?: Record<string, Record<string, unknown>>
    signal?: AbortSignal
  } = {}) {
    const response = await this.request('audio/speech', {
      method: 'POST',
      signal: signal ?? AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: this.model,
        voice: this.voice,
        input,
        response_format: format,
        ...character ? {instructions: character} : {},
        ...providerOptions ? {provider: {options: providerOptions}} : {},
      }),
    })
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Narration unavailable (${response.status}): ${error.slice(0, 2000)}`)
    }
    const type = response.headers.get('content-type') ?? ''
    if (!/^audio\/(?:mp3|mpeg|ogg|pcm|wav|x-wav)(?:;|$)/i.test(type)) {
      throw new Error('The speech provider returned an unsupported audio format.')
    }
    const blob = await response.blob()
    if (!blob.size || blob.size > 25_000_000) {
      throw new Error('The speech provider returned invalid audio.')
    }
    if (/^audio\/pcm(?:;|$)/i.test(type)) {
      const rate = /(?:^|;)\s*rate=(\d+)/iu.exec(type)?.[1]
      const channels = /(?:^|;)\s*channels=(\d+)/iu.exec(type)?.[1]
      if (channels && Number(channels) !== 1) {
        throw new Error(`Expected mono PCM audio, received ${type}.`)
      }
      return pcmWave(await blob.arrayBuffer(), rate ? Number(rate) : 24_000)
    }
    return blob
  }
}
