import {afterEach, expect, spyOn, test} from 'bun:test'

import NarrationAligner from '../../src/lib/ai/NarrationAligner.ts'

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined
afterEach(() => fetchSpy?.mockRestore())
test('generated audio goes to OpenRouter’s transcription endpoint for word timestamps, which land on the narration’s own words', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
    text: 'his unbothered majesty',
    words: [
      {
        word: 'His',
        start: 0.2,
        end: 0.4,
      },
      {
        word: 'unbothered',
        start: 0.5,
        end: 1.2,
      },
      {
        word: 'majesty,',
        start: 1.2,
        end: 1.9,
      },
    ],
  }))
  const aligner = new NarrationAligner({key: 'test-key'}, 'x-ai/grok-stt-2.0')
  const timing = await aligner.align(new Blob(['RIFF'], {type: 'audio/wav'}), 'His Unbothered Majesty.')
  const [url, request] = fetchSpy.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/audio/transcriptions')
  const headers = new Headers(request!.headers)
  expect(headers.get('HTTP-Referer')).toBe('https://slop.gallery')
  expect(JSON.parse(request!.body as string)).toEqual({
    model: 'x-ai/grok-stt-2.0',
    input_audio: {
      data: btoa('RIFF'),
      format: 'wav',
    },
    language: 'en',
    temperature: 0,
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  })
  expect(timing.words.map(word => word.start)).toEqual([0.2, 0.5, 1.2])
  expect(timing.words.at(-1)!.to).toBe('His Unbothered Majesty.'.length)
})
test('a transcript without word timestamps or a failed request is an error, not an empty timing', async () => {
  const aligner = new NarrationAligner({key: 'test-key'}, 'x-ai/grok-stt-2.0')
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({text: 'his'}))
  expect(aligner.align(new Blob(['x'], {type: 'audio/wav'}), 'His')).rejects.toThrow('no word timestamps')
  fetchSpy.mockResolvedValue(new Response('nope', {status: 400}))
  expect(aligner.align(new Blob(['x'], {type: 'audio/wav'}), 'His')).rejects.toThrow('(400)')
  expect(aligner.align(new Blob(['x'], {type: 'text/plain'}), 'His')).rejects.toThrow('cannot be aligned')
})
