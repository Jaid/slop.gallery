import {afterEach, expect, spyOn, test} from 'bun:test'

import ExternalGenerator from '../../src/lib/ai/ExternalGenerator.ts'
import FusionGenerator from '../../src/lib/ai/FusionGenerator.ts'
import NarrationGenerator from '../../src/lib/ai/NarrationGenerator.ts'
import pcmWave from '../../src/lib/audio/pcmWave.ts'

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined
afterEach(() => fetchSpy?.mockRestore())
test('Grok Iris uses English provider options and preserves the declared PCM sample rate', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Int16Array(100), {headers: {'content-type': 'audio/pcm;rate=48000;channels=1'}}))
  const grokNarrator = new NarrationGenerator({key: 'test-key'}, 'x-ai/grok-voice-tts-1.0', 'iris')
  const blob = await grokNarrator.generate('GPT-6 Astra.', {
    format: 'pcm',
    providerOptions: {xai: {language: 'en'}},
  })
  expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({
    model: 'x-ai/grok-voice-tts-1.0',
    voice: 'iris',
    input: 'GPT-6 Astra.',
    response_format: 'pcm',
    provider: {options: {xai: {language: 'en'}}},
  })
  const waveHeader = new DataView(await blob.arrayBuffer())
  expect(waveHeader.getUint32(24, true)).toBe(48_000)
})
test('the narrator character goes out as top-level delivery instructions', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Int16Array(100), {headers: {'content-type': 'audio/pcm'}}))
  const geminiNarrator = new NarrationGenerator({key: 'test-key'}, 'google/gemini-3.8-flash-tts', 'Algenib')
  await geminiNarrator.generate('GLM 5.3', {character: 'calm'})
  expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({
    model: 'google/gemini-3.8-flash-tts',
    voice: 'Algenib',
    input: 'GLM 5.3',
    response_format: 'pcm',
    instructions: 'calm',
  })
})
test('stereo PCM cannot silently become a mono file at the wrong speed', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Int16Array(100), {headers: {'content-type': 'audio/pcm;rate=24000;channels=2'}}))
  const grokNarrator = new NarrationGenerator({key: 'test-key'}, 'x-ai/grok-voice-tts-1.0', 'iris')
  await expect(grokNarrator.generate('Hello.', {format: 'pcm'})).rejects.toThrow('Expected mono PCM')
})
test('Gemini speech uses PCM and the central Slop Gallery app attribution', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([0, 0, 1, 0]), {headers: {'content-type': 'audio/pcm'}}))
  const geminiNarrator = new NarrationGenerator({key: 'test-key'}, 'google/gemini-3.8-flash-tts', 'Algenib')
  const blob = await geminiNarrator.generate('GLM 5.3')
  const [url, options] = fetchSpy.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/audio/speech')
  const headers = new Headers(options!.headers)
  expect(headers.get('Authorization')).toBe('Bearer test-key')
  expect(headers.get('HTTP-Referer')).toBe('https://slop.gallery')
  expect(headers.get('X-OpenRouter-Title')).toBe('Slop Gallery')
  expect(headers.get('X-OpenRouter-Categories')).toBe('game,image-gen')
  expect(JSON.parse(options!.body as string)).toEqual({
    model: 'google/gemini-3.8-flash-tts',
    voice: 'Algenib',
    input: 'GLM 5.3',
    response_format: 'pcm',
  })
  expect(blob.type).toBe('audio/wav')
  const bytes = await blob.arrayBuffer()
  const chunkIdDecoder = new TextDecoder
  expect(chunkIdDecoder.decode(bytes.slice(0, 4))).toBe('RIFF')
  const waveHeader = new DataView(bytes)
  expect(waveHeader.getUint32(24, true)).toBe(24_000)
  const waveBytes = new Uint8Array(bytes)
  expect(waveBytes.slice(44)).toEqual(new Uint8Array([0, 0, 1, 0]))
})
test('all raw endpoints enforce attribution and cannot leak a key to another host', async () => {
  class Generator extends ExternalGenerator {}
  const generator = new Generator({key: 'test-key'})
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
  await generator.request('../beta/batches', {
    method: 'POST',
    headers: {'X-OpenRouter-Title': 'Wrong'},
    body: '{}',
  })
  expect(fetchSpy.mock.calls[0][0]).toBe('https://openrouter.ai/api/beta/batches')
  const sentHeaders = new Headers(fetchSpy.mock.calls[0][1]!.headers)
  expect(sentHeaders.get('X-OpenRouter-Title')).toBe('Slop Gallery')
  expect(() => generator.request('https://example.com/api/steal')).toThrow()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('another origin serves every endpoint and never gets the key, nor can requests go to OpenRouter itself', async () => {
  class Generator extends ExternalGenerator {}
  const generator = new Generator({
    key: 'test-key',
    origin: 'https://openrouter.nas.lan',
  })
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
  await generator.request('audio/speech', {
    method: 'POST',
    body: '{}',
  })
  expect(fetchSpy.mock.calls[0][0]).toBe('https://openrouter.nas.lan/api/v1/audio/speech')
  const headers = new Headers(fetchSpy.mock.calls[0][1]!.headers)
  expect(headers.has('Authorization')).toBe(false)
  expect(() => generator.request('https://openrouter.ai/api/v1/audio/speech')).toThrow()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('raw and SDK requests to another host go out without any Authorization header, even with a key, as it adds its own', async () => {
  const access = {
    key: 'test-key',
    origin: 'https://openrouter.nas.lan',
  }
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Int16Array(100), {headers: {'content-type': 'audio/pcm'}}))
  const narrationGenerator = new NarrationGenerator(access, 'google/gemini-3.8-flash-tts', 'Algenib')
  await narrationGenerator.generate('Hello.')
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy.mockResolvedValue(Response.json({
    id: 'test',
    object: 'chat.completion',
    created: 1,
    model: 'test-image-model',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: '',
        images: [{
          type: 'image_url',
          image_url: {url: `data:image/png;base64,${data.toBase64()}`},
        }],
      },
    }],
  }))
  const fusionGenerator = new FusionGenerator(access, 'test-image-model')
  await fusionGenerator.generate({
    images: [data],
    text: 'Make it spooky.',
  })
  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
    'https://openrouter.nas.lan/api/v1/audio/speech',
    'https://openrouter.nas.lan/api/v1/chat/completions',
  ])
  for (const [, init] of fetchSpy.mock.calls) {
    const headers = new Headers(init!.headers)
    expect(headers.has('Authorization')).toBe(false)
    expect(headers.get('X-OpenRouter-Title')).toBe('Slop Gallery')
  }
})
test('rejects malformed audio and wraps only complete 16-bit PCM samples', async () => {
  expect(() => pcmWave(new ArrayBuffer(1))).toThrow()
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {headers: {'content-type': 'application/json'}}))
  const geminiNarrator = new NarrationGenerator({key: 'test'}, 'google/gemini-3.8-flash-tts', 'Algenib')
  await expect(geminiNarrator.generate('Hello')).rejects.toThrow('unsupported audio')
})
