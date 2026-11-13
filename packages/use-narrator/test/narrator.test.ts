import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import {FakeClock, FakePlayback, flush} from '../packages/use-audio-queue/test/helpers.ts'
import useNarrator, {narrationState, narrationStates, Narrator} from '../src/main.ts'

const setup = (options: ConstructorParameters<typeof Narrator>[0] = {}) => {
  const clock = new FakeClock
  const players: Array<FakePlayback> = []
  const create = (name: string) => {
    const player = new FakePlayback(name)
    players.push(player)
    return player
  }
  const narrator = new Narrator({
    clock,
    createAudio: reference => create(`audio:${reference instanceof Blob ? 'blob' : String(reference)}`),
    createSpeech: speech => create(`speech:${speech.text}`),
    ...options,
  })
  return {
    narrator,
    clock,
    players,
    create,
  }
}
test('files and text share one queue, with title/source metadata belonging to the current entry', async () => {
  const {narrator, players} = setup()
  narrator.push({
    audio: '/first.opus',
    title: 'Recording',
  }, {id: 'a'})
  narrator.push('Spoken words', {id: 'b'})
  await flush()
  expect(players.map(p => p.name)).toEqual(['audio:/first.opus'])
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    id: 'a',
    title: 'Recording',
    source: 'audio',
    status: 'playing',
  })
  players[0].end()
  await flush()
  expect(players.map(p => p.name)).toEqual(['audio:/first.opus', 'speech:Spoken words'])
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    id: 'b',
    source: 'browser',
    status: 'playing',
  })
  narrator.dispose()
})
test('indicator metadata remains visible through both silent phases', async () => {
  const {narrator, players, clock} = setup({
    prependedSilence: 0.2,
    appendedSilence: 0.3,
  })
  const handle = narrator.push({
    audio: '/voice.opus',
    title: 'Title',
  })
  await flush()
  expect(narrationState(narrator.getSnapshot())?.status).toBe('before')
  expect(players[0].plays).toBe(0)
  await clock.advance(0.2)
  expect(narrationState(narrator.getSnapshot())?.status).toBe('playing')
  players[0].end()
  await flush()
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    title: 'Title',
    status: 'after',
    statusEndsAt: 0.5,
  })
  await clock.advance(0.3)
  expect(await handle.finished).toEqual({status: 'completed'})
  expect(narrationState(narrator.getSnapshot())).toBeNull()
})
test('once remembers completion, deduplicates unfinished entries, and supports explicit replay', async () => {
  const {narrator, players} = setup()
  const first = narrator.push('Model', {once: 'model'})
  expect(narrator.push('Model again', {once: 'model'})).toBe(first)
  await flush()
  expect(narrator.hasSpoken('model')).toBe(false)
  players[0].end()
  await first.finished
  expect(narrator.hasSpoken('model')).toBe(true)
  expect(await narrator.push('Model', {once: 'model'}).finished).toEqual({
    status: 'skipped',
    reason: 'remembered',
  })
  const replay = narrator.push('Model', {
    once: 'model',
    repeat: true,
  })
  await flush()
  expect(players).toHaveLength(2)
  players[1].end()
  await replay.finished
  expect(narrator.hasSpoken('model')).toBe(true)
  narrator.forget('model')
  expect(narrator.hasSpoken('model')).toBe(false)
})
test('interrupted, cancelled and failed announcements are not remembered', async () => {
  const {narrator, players} = setup()
  const cancelled = narrator.push('Cancelled', {once: 'key'})
  await flush()
  cancelled.cancel()
  const cancelledResult = await cancelled.finished
  expect(cancelledResult.status).toBe('cancelled')
  expect(narrator.hasSpoken('key')).toBe(false)
  const failed = narrator.push('Retry', {once: 'key'})
  await flush()
  players[1].completion.reject(new Error('No voice'))
  const failedResult = await failed.finished
  expect(failedResult.status).toBe('failed')
  expect(narrator.hasSpoken('key')).toBe(false)
  narrator.dispose()
})
test('provider-generated speech uses the same pausable audio transport as recordings', async () => {
  const calls: Array<string> = []
  const {narrator, players} = setup({synthesize: speech => {
    calls.push(speech.text)
    return '/generated.opus'
  }})
  narrator.push('Generated speech')
  await flush()
  expect(calls).toEqual(['Generated speech'])
  expect(players[0].name).toBe('audio:/generated.opus')
  players[0].position = 2.5
  const insert = narrator.push({audio: '/insert.opus'}, {priority: 'inject'})
  await flush()
  expect(players[0].pauses).toBe(1)
  players[1].end()
  await insert.finished
  await flush()
  expect(players[0].position).toBe(2.5)
  expect(players[0].plays).toBe(2)
  narrator.dispose()
})
test('generation failure falls back inside the same slot and cannot overtake queued narration', async () => {
  let fallbacks = 0
  const {narrator, players} = setup({
    synthesize: () => {
      throw new Error('Provider unavailable')
    },
    onFallback: () => {
      fallbacks++
    },
  })
  const first = narrator.push('Fallback', {id: 'first'})
  const second = narrator.push({audio: '/next.opus'})
  await flush()
  expect(fallbacks).toBe(1)
  expect(players[0].name).toBe('speech:Fallback')
  expect(narrator.getSnapshot().current?.id).toBe(first.id)
  expect(narrator.getSnapshot().pending[0].id).toBe(second.id)
  players[0].end()
  await flush()
  expect(players[1].name).toBe('audio:/next.opus')
  narrator.dispose()
})
for (const duringStart of [true, false]) {
  test(`recording failure falls back exactly once ${duringStart ? 'during start' : 'after start'}`, async () => {
    let fallbacks = 0
    const audio = new FakePlayback('audio')
    if (duringStart) {
      audio.play = () => {
        audio.completion.reject(new Error('media error'))
        throw new Error('play rejected')
      }
    }
    const {narrator, players} = setup({
      createAudio: () => audio,
      onFallback: () => {
        fallbacks++
      },
    })
    const handle = narrator.push({
      audio: '/broken.opus',
      text: 'Fallback words',
    })
    await flush()
    if (!duringStart) {
      audio.completion.reject(new Error('media error'))
    }
    await flush()
    expect(fallbacks).toBe(1)
    expect(audio.disposals).toBe(1)
    expect(players).toHaveLength(1)
    expect(players[0].name).toBe('speech:Fallback words')
    expect(players[0].plays).toBe(1)
    expect(narrationState(narrator.getSnapshot())?.source).toBe('browser')
    players[0].end()
    const result = await handle.finished
    expect(result.status).toBe('completed')
  })
}
test('stopping during deferred preparation discards late output instead of playing it', async () => {
  const ready = Promise.withResolvers<FakePlayback>()
  const late = new FakePlayback
  const {narrator} = setup({createAudio: () => ready.promise})
  const handle = narrator.push({audio: '/late.opus'})
  await flush()
  narrator.stop()
  ready.resolve(late)
  await flush()
  const result = await handle.finished
  expect(result.status).toBe('cancelled')
  expect(late.plays).toBe(0)
  expect(late.disposals).toBe(1)
  expect(narrator.getSnapshot().idle).toBe(true)
})
test('injection while a fallback is preparing does not let that fallback overlap the injection', async () => {
  const ready = Promise.withResolvers<FakePlayback>()
  const fallback = new FakePlayback('fallback')
  const {narrator, players} = setup({createSpeech: () => ready.promise})
  narrator.push({
    audio: '/broken.opus',
    text: 'Fallback',
  })
  await flush()
  players[0].completion.reject(new Error('broken'))
  await flush()
  narrator.push({audio: '/insert.opus'}, {priority: 'inject'})
  await flush()
  ready.resolve(fallback)
  await flush()
  expect(fallback.plays).toBe(0)
  players[1].end()
  await flush()
  expect(fallback.plays).toBe(1)
  narrator.dispose()
})
test('stopping during fallback preparation disposes the late fallback without speaking', async () => {
  const ready = Promise.withResolvers<FakePlayback>()
  const fallback = new FakePlayback
  const {narrator, players} = setup({createSpeech: () => ready.promise})
  const handle = narrator.push({
    audio: '/broken.opus',
    text: 'Fallback',
  })
  await flush()
  players[0].completion.reject(new Error('broken'))
  await flush()
  narrator.stop()
  ready.resolve(fallback)
  await flush()
  const result = await handle.finished
  expect(result.status).toBe('cancelled')
  expect(fallback.disposals).toBe(1)
  expect(fallback.plays).toBe(0)
})
test('recordings without fallback text fail without requesting speech, then the queue continues', async () => {
  let failures = 0
  const {narrator, players} = setup({onError: () => {
    failures++
  }})
  const broken = narrator.push({audio: '/broken.opus'})
  narrator.push({audio: '/good.opus'})
  await flush()
  players[0].completion.reject(new Error('broken'))
  await flush()
  const brokenResult = await broken.finished
  expect(brokenResult.status).toBe('failed')
  expect(failures).toBe(1)
  expect(players.map(p => p.name)).toEqual(['audio:/broken.opus', 'audio:/good.opus'])
  narrator.dispose()
})
test('disabling narration clears both lanes and skips new requests until re-enabled', async () => {
  const {narrator, players} = setup()
  const first = narrator.push('First')
  const second = narrator.push('Second')
  const concurrent = narrator.push({audio: '/parallel.opus'}, {priority: 'async'})
  await flush()
  narrator.enabled = false
  for (const handle of [first, second, concurrent]) {
    const result = await handle.finished
    expect(result.status).toBe('cancelled')
  }
  expect(await narrator.push('Muted').finished).toEqual({
    status: 'skipped',
    reason: 'disabled',
  })
  narrator.enabled = true
  narrator.push('Enabled')
  await flush()
  expect(players.at(-1)!.name).toBe('speech:Enabled')
  narrator.dispose()
})
test('pausing holds recordings, speech and silences where they are until the narrator resumes', async () => {
  const {narrator, players, clock} = setup({
    prependedSilence: 0.2,
    appendedSilence: 0.3,
  })
  const first = narrator.push({
    audio: '/voice.opus',
    title: 'Recording',
  }, {id: 'a'})
  narrator.push('Spoken words', {id: 'b'})
  await clock.advance(0.2)
  players[0].position = 4
  expect(narrator.paused).toBe(false)
  narrator.pause()
  expect(narrator.paused).toBe(true)
  expect(narrator.getSnapshot().paused).toBe(true)
  expect(players[0].playing).toBe(false)
  // What shows of the narration stays, without a deadline to run toward.
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    id: 'a',
    title: 'Recording',
    status: 'playing',
    statusEndsAt: undefined,
  })
  await clock.advance(60)
  expect(players).toHaveLength(1)
  narrator.resume()
  await flush()
  expect(narrator.paused).toBe(false)
  expect(players[0].playing).toBe(true)
  expect(players[0].position).toBe(4)
  players[0].end()
  await clock.advance(0.1)
  narrator.pause()
  await clock.advance(60)
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    id: 'a',
    status: 'after',
    statusEndsAt: undefined,
  })
  narrator.resume()
  await clock.advance(0.2)
  expect(await first.finished).toEqual({status: 'completed'})
  // Paused while the next one prepares, it only speaks once the narrator resumes, after its own silence.
  narrator.pause()
  await clock.advance(60)
  expect(players.map(player => player.name)).toEqual(['audio:/voice.opus', 'speech:Spoken words'])
  expect(players[1].plays).toBe(0)
  narrator.stop()
  await flush()
  expect(players[1].disposals).toBe(1)
  expect(narrator.getSnapshot()).toMatchObject({
    idle: true,
    paused: true,
  })
  narrator.dispose()
})
test('concurrent narration exposes separate visible states while the singular projection keeps foreground precedence', async () => {
  const {narrator} = setup()
  narrator.push('Parallel one', {
    priority: 'async',
    id: 'parallel-one',
  })
  narrator.push('Parallel two', {
    priority: 'async',
    id: 'parallel-two',
  })
  await flush()
  expect(narrationStates(narrator.getSnapshot()).map(state => state.id)).toEqual(['parallel-one', 'parallel-two'])
  expect(narrationState(narrator.getSnapshot())?.id).toBe('parallel-two')
  narrator.push('Foreground', {id: 'foreground'})
  await flush()
  const states = narrationStates(narrator.getSnapshot())
  expect(states.map(state => state.id)).toEqual(['foreground', 'parallel-one', 'parallel-two'])
  const instanceIds = new Set(states.map(state => state.instanceId))
  expect(instanceIds.size).toBe(3)
  expect(narrationState(narrator.getSnapshot())?.id).toBe('foreground')
  narrator.dispose()
})
test('the React subscription can render on the server without creating browser audio or owning lifetime', () => {
  const {narrator, players} = setup()
  function Probe() {
    const state = useNarrator(narrator)
    return createElement('span', null, state.idle ? 'idle' : 'busy')
  }
  expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>idle</span>')
  expect(players).toHaveLength(0)
  narrator.push('Still usable after rendering')
  expect(narrator.getSnapshot().idle).toBe(false)
  narrator.dispose()
})
class TimedPlayback extends FakePlayback {
  progress = () => ({seconds: this.seconds})
  seconds = 0
}
const timing = {words: [{
  from: 0,
  to: 5,
  start: 0.1,
  end: 0.5,
}]}
test('a recording’s timing reaches the narration state, and its playback progress is readable by instance', async () => {
  const clock = new FakeClock
  const players: Array<TimedPlayback> = []
  const narrator = new Narrator({clock, createAudio: () => {
    const player = new TimedPlayback('audio')
    players.push(player)
    return player
  }})
  const handle = narrator.push({
    audio: '/voice.opus',
    text: 'Hello',
    timing,
  })
  await flush()
  const state = narrationState(narrator.getSnapshot())!
  expect(state.timing).toBe(timing)
  players[0].seconds = 0.3
  expect(narrator.progress(state.instanceId)).toEqual({seconds: 0.3})
  players[0].end()
  await handle.finished
  expect(narrator.progress(state.instanceId)).toBeUndefined()
  narrator.dispose()
})
test('a synthesizer can return a timing with its audio, which native fallback speech drops again', async () => {
  const {narrator, players} = setup({synthesize: () => ({
    audio: new Blob(['voice']),
    timing,
  })})
  narrator.push('Hello')
  await flush()
  expect(narrationState(narrator.getSnapshot())).toMatchObject({
    source: 'audio',
    timing,
  })
  players[0].completion.reject(new Error('decode failed'))
  await flush()
  const state = narrationState(narrator.getSnapshot())!
  expect(state.source).toBe('browser')
  expect(state.timing).toBeUndefined()
  narrator.dispose()
})
