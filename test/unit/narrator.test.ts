import type {AiSettings} from '../../src/lib/ai/settings.ts'

import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

import {narrationState, Narrator} from 'use-narrator/core'

import {FakePlayback, flush} from '../../packages/use-narrator/packages/use-audio-queue/test/helpers.ts'
import {readAiSettings} from '../../src/lib/ai/settings.ts'
import {narratorCharacter, narratorVoice} from '../../src/lib/audio/narratorCharacter.ts'
import PortraitNarration from '../../src/lib/audio/PortraitNarration.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import samplePortraits from './fixtures/portraits.ts'

type SpeechRequestBody = {
  input: string
  instructions: string
  response_format: string
  voice: string
}

const settings: AiSettings = readAiSettings()
let producer: PortraitNarration
let narrator: Narrator
let players: Array<FakePlayback>
let recordings: Array<unknown>
let spoken: Array<string>
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined
beforeEach(() => {
  players = []
  recordings = []
  spoken = []
  narrator = new Narrator({
    createAudio: reference => {
      recordings.push(reference)
      const player = new FakePlayback('audio')
      players.push(player)
      return player
    },
    createSpeech: speech => {
      spoken.push(speech.text)
      const player = new FakePlayback('speech')
      players.push(player)
      return player
    },
  })
  useGallery.setState({
    sound: true,
    narration: null,
    portraits: samplePortraits.map(p => ({
      ...p,
      narration: undefined,
    })),
  })
})
afterEach(() => {
  producer.dispose()
  narrator.dispose()
  fetchSpy?.mockRestore()
  fetchSpy = undefined
  useGallery.setState({
    sound: false,
    narration: null,
  })
})
const create = (overrides: Partial<AiSettings> = {}, key = '') => {
  producer = new PortraitNarration({
    ...settings,
    ai: false,
    // Alignment has its own test, so the rest count speech requests alone.
    stt_model: false,
    ...overrides,
  }, {key}, narrator)
  return producer
}
test('pending portraits keep request order rather than replacing each other', async () => {
  create()
  useGallery.getState().update('goose', {pending: true})
  useGallery.getState().update('orange', {pending: true})
  producer.enqueue('goose')
  producer.enqueue('orange')
  await flush()
  expect(narrationState(narrator.getSnapshot())?.id).toBe('goose')
  expect(spoken).toHaveLength(0)
  useGallery.getState().update('orange', {
    pending: false,
    title: 'Orange ready',
  })
  await flush()
  expect(spoken).toHaveLength(0)
  useGallery.getState().update('goose', {
    pending: false,
    title: 'Goose ready',
  })
  await flush()
  expect(spoken[0]).toStartWith('Goose ready.')
  players[0].end()
  await flush()
  expect(spoken[1]).toStartWith('Orange ready.')
})
test('stopping a waiting portrait prevents later label readiness from starting it', async () => {
  create()
  useGallery.getState().update('goose', {pending: true})
  const handle = producer.enqueue('goose')!
  await flush()
  producer.stop()
  useGallery.getState().update('goose', {pending: false})
  producer.ready('goose')
  await flush()
  const handleOutcome = await handle.finished
  expect(handleOutcome.status).toBe('cancelled')
  expect(spoken).toHaveLength(0)
  expect(narrator.getSnapshot().idle).toBe(true)
})
test('TTS keeps character steering out of speech and caches successful generated audio', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['audio'], {type: 'audio/mpeg'})))
  create({ai: true}, 'test-key')
  const first = producer.enqueue('goose')!
  await flush()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  const [url, request] = fetchSpy.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/audio/speech')
  const body = JSON.parse(request!.body as string) as SpeechRequestBody
  const character = narratorCharacter(environmentSeed)
  expect(body.input).not.toContain(character)
  expect(body.instructions).toBe(character)
  expect(body.voice).toBe(narratorVoice(environmentSeed))
  expect(body.response_format).toBe('pcm')
  expect(recordings[0]).toBeInstanceOf(Blob)
  players[0].end()
  await first.finished
  await flush()
  producer.enqueue('goose')
  await flush()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(recordings).toHaveLength(2)
})
test('a failed speech provider falls back to browser speech in the shared queue', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unavailable', {status: 503}))
  create({ai: true}, 'test-key')
  producer.enqueue('goose')
  await flush()
  expect(spoken).toHaveLength(1)
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    id: 'goose',
    status: 'playing',
    source: 'browser',
  })
})
test('bundled narration is queued as a URL without a provider or redundant fetch', async () => {
  useGallery.setState({portraits: samplePortraits.map(p => ({...p}))})
  fetchSpy = spyOn(globalThis, 'fetch')
  create()
  producer.enqueue('goose')
  await flush()
  expect(recordings).toEqual(['/audio/goose.opus'])
  expect(narrationState(narrator.getSnapshot())?.timing).toBeUndefined()
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(spoken).toHaveLength(0)
})
test('a manual label edit releases pending narration without waiting for the old generator', async () => {
  create()
  useGallery.getState().update('goose', {pending: true})
  producer.enqueue('goose')
  await flush()
  const state = useGallery.getState()
  state.commit(state.portraits.map(p => (p.id === 'goose' ? {
    ...p,
    title: 'My label',
    description: 'My story',
    pending: false,
  } : p)))
  await flush()
  expect(spoken).toEqual(['My label. My story.'])
  producer.ready('goose')
  await flush()
  expect(spoken).toHaveLength(1)
})
/** Leaves the work with the id without anything told about it, like an import before its flavor text is written. */
const untell = (id: string) => {
  const state = useGallery.getState()
  state.commit(state.portraits.map(p => {
    if (p.id !== id) {
      return p
    }
    const {creator, description, title, ...untold} = p
    return untold
  }))
}
test('a work without a flavor text has nothing to read, unless one is being written', async () => {
  create()
  untell('goose')
  expect(producer.enqueue('goose')).toBeUndefined()
  await flush()
  expect(narrator.getSnapshot().idle).toBe(true)
  // Written without a title, only the description is read.
  useGallery.getState().update('goose', {pending: true})
  const handle = producer.enqueue('goose')!
  expect(handle).toBeDefined()
  await flush()
  useGallery.getState().update('goose', {
    pending: false,
    description: 'A story without a name',
  })
  await flush()
  expect(spoken).toEqual(['A story without a name.'])
})
test('a flavor text that fails leaves the waiting narration nothing to read, which ends without a word', async () => {
  create()
  untell('goose')
  useGallery.getState().update('goose', {pending: true})
  const handle = producer.enqueue('goose')!
  await flush()
  useGallery.getState().update('goose', {pending: false})
  const outcome = await handle.finished
  expect(outcome.status).toBe('cancelled')
  expect(spoken).toHaveLength(0)
  expect(narrator.getSnapshot().idle).toBe(true)
})
test('editing a spoken portrait cancels its transport without interrupting unrelated narration', async () => {
  create()
  const first = producer.enqueue('goose')!
  const second = narrator.push('Unrelated story')
  await flush()
  useGallery.getState().update('goose', {description: 'Replacement story'})
  await flush()
  const firstOutcome = await first.finished
  expect(firstOutcome.status).toBe('cancelled')
  expect(players[0].disposals).toBe(1)
  expect(narrator.getSnapshot().current?.id).toBe(second.id)
})
test('replacing a story cancels in-flight generation and prevents late output/fallback', async () => {
  const fetched = Promise.withResolvers<Response>()
  fetchSpy = spyOn(globalThis, 'fetch').mockReturnValue(fetched.promise)
  create({ai: true}, 'test-key')
  const handle = producer.enqueue('goose')!
  await flush()
  const signal = fetchSpy.mock.calls[0][1]!.signal!
  useGallery.getState().update('goose', {description: 'A replacement story'})
  expect(signal.aborted).toBe(true)
  fetched.resolve(new Response(new Blob(['audio'], {type: 'audio/mpeg'})))
  await flush()
  const handleOutcome = await handle.finished
  expect(handleOutcome.status).toBe('cancelled')
  expect(recordings).toHaveLength(0)
  expect(spoken).toHaveLength(0)
})
test('removing a queued portrait cancels just that request', async () => {
  create()
  const first = producer.enqueue('goose')!
  const removed = producer.enqueue('orange')!
  await flush()
  useGallery.getState().remove('orange')
  await flush()
  const removedOutcome = await removed.finished
  expect(removedOutcome.status).toBe('cancelled')
  expect(narrator.getSnapshot().current?.id).toBe(first.id)
})
test('producer disposal does not stop narration owned by another component', async () => {
  create()
  const independent = narrator.push('Independent')
  const owned = producer.enqueue('goose')!
  await flush()
  producer.dispose()
  const ownedOutcome = await owned.finished
  expect(ownedOutcome.status).toBe('cancelled')
  expect(narrator.getSnapshot().current?.id).toBe(independent.id)
  expect(players[0].disposals).toBe(0)
})
test('repeated requests deduplicate only while alive, including immediate stop/re-enqueue', async () => {
  create()
  const first = producer.enqueue('goose')!
  expect(producer.enqueue('goose')).toBe(first)
  await flush()
  narrator.stop()
  const second = producer.enqueue('goose')!
  expect(second).not.toBe(first)
  await flush()
  expect(narrator.getSnapshot().current?.id).toBe(second.id)
})
test('eager generation populates the same cache without playing or taking a queue slot', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['audio'], {type: 'audio/mpeg'})))
  create({
    ai: true,
    eager_audio: true,
  }, 'test-key')
  producer.ready('goose')
  await flush()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(narrator.getSnapshot().idle).toBe(true)
  expect(players).toHaveLength(0)
  producer.enqueue('goose')
  await flush()
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(players).toHaveLength(1)
})
const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : input.toString())
/** answers transcription requests with `transcription` and speech requests with generated audio */
const routedFetch = (transcription: Response) => (async (input: RequestInfo | URL) => (urlOf(input).endsWith('/audio/transcriptions') ? transcription.clone() : new Response(new Blob(['audio'], {type: 'audio/mpeg'})))) as typeof fetch
test('generated speech is aligned before it plays, so the narration carries its timing, and only once thanks to the cache', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(routedFetch(Response.json({
    words: [{
      word: 'his',
      start: 0.1,
      end: 0.3,
    }, {
      word: 'unbothered',
      start: 0.4,
      end: 1,
    }],
  })))
  create({
    ai: true,
    stt_model: 'x-ai/grok-stt-2.0',
  }, 'test-key')
  const first = producer.enqueue('goose')!
  await flush()
  expect(fetchSpy.mock.calls.map(([url]) => urlOf(url))).toEqual(['https://openrouter.ai/api/v1/audio/speech', 'https://openrouter.ai/api/v1/audio/transcriptions'])
  expect(JSON.parse(fetchSpy.mock.calls[1][1]!.body as string)).toMatchObject({
    model: 'x-ai/grok-stt-2.0',
    input_audio: {format: 'mp3'},
  })
  const state = narrationState(narrator.getSnapshot())!
  expect(state.source).toBe('audio')
  expect(state.timing?.words[1]).toMatchObject({
    start: 0.4,
    end: 1,
  })
  players[0].end()
  await first.finished
  producer.enqueue('goose')
  await flush()
  expect(fetchSpy).toHaveBeenCalledTimes(2)
  expect(narrationState(narrator.getSnapshot())?.timing).toBe(state.timing)
})
test('a failed alignment still plays the generated audio, just without a timing', async () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(routedFetch(new Response('busy', {status: 503})))
  create({
    ai: true,
    stt_model: 'x-ai/grok-stt-2.0',
  }, 'test-key')
  producer.enqueue('goose')
  await flush()
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    source: 'audio',
    timing: undefined,
  })
  expect(recordings[0]).toBeInstanceOf(Blob)
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})
