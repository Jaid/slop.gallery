import {afterEach, beforeEach, expect, test} from 'bun:test'

import {Narrator} from 'use-narrator/core'

import {FakeClock, FakePlayback, flush} from '../../packages/use-narrator/packages/use-audio-queue/test/helpers.ts'
import {attachNarration} from '../../src/lib/audio/narration.ts'
import {galleryEvents} from '../../src/lib/gallery/actions.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import worldTime from '../../src/lib/worldTime.ts'

let narrator: Narrator
let clock: FakeClock
let events: EventTarget
let players: Array<FakePlayback>
let detach: () => void
beforeEach(() => {
  clock = new FakeClock
  events = new EventTarget
  players = []
  narrator = new Narrator({clock, prependedSilence: 0.1, appendedSilence: 0.2, createAudio: () => {
    const player = new FakePlayback
    players.push(player)
    return player
  }})
  useGallery.setState({
    sound: true,
    narration: null,
  })
  detach = attachNarration(narrator, events)
})
afterEach(() => {
  detach()
  narrator.dispose()
  useGallery.setState({
    sound: false,
    narration: null,
  })
})
test('the telemetry projection follows the shared narrator through preparation and both silent phases', async () => {
  const handle = narrator.push({
    audio: '/voice.opus',
    title: 'Title',
  }, {id: 'voice'})
  expect(useGallery.getState().narration).toMatchObject({
    id: 'voice',
    status: 'preparing',
  })
  await flush()
  expect(useGallery.getState().narration).toMatchObject({
    id: 'voice',
    title: 'Title',
    status: 'before',
  })
  await clock.advance(0.1)
  expect(useGallery.getState().narration).toMatchObject({
    status: 'playing',
    source: 'audio',
  })
  players[0].end()
  await flush()
  expect(useGallery.getState().narration).toMatchObject({
    title: 'Title',
    status: 'after',
  })
  await clock.advance(0.2)
  expect(await handle.finished).toEqual({status: 'completed'})
  expect(useGallery.getState().narration).toBeNull()
})
test('mute clears every shared lane and prevents new playback until re-enabled', async () => {
  const handles = [narrator.push({audio: '/first.opus'}), narrator.push({audio: '/second.opus'}), narrator.push({audio: '/parallel.opus'}, {priority: 'async'})]
  await clock.advance(0.1)
  useGallery.setState({sound: false})
  for (const handle of handles) {
    const result = await handle.finished
    expect(result.status).toBe('cancelled')
  }
  expect(useGallery.getState().narration).toBeNull()
  expect(narrator.enabled).toBe(false)
  expect(await narrator.push('Muted').finished).toEqual({
    status: 'skipped',
    reason: 'disabled',
  })
  useGallery.setState({sound: true})
  expect(narrator.enabled).toBe(true)
})
for (const name of ['stop-narration', 'teleport', 'pagehide']) {
  test(`${name} clears suspended, current and pending narration through one handler`, async () => {
    narrator.push({audio: '/original.opus'})
    narrator.push({audio: '/later.opus'})
    await clock.advance(0.1)
    narrator.push({audio: '/injected.opus'}, {priority: 'inject'})
    await clock.advance(0.1)
    ;(name === 'pagehide' ? events : galleryEvents).dispatchEvent(new Event(name))
    expect(narrator.getSnapshot().idle).toBe(true)
    expect(useGallery.getState().narration).toBeNull()
    expect(players.every(player => player.disposals === 1)).toBe(true)
  })
}
test('effect replay clears abandoned work without permanently disposing the app narrator', async () => {
  const abandoned = narrator.push({audio: '/abandoned.opus'})
  await flush()
  detach()
  expect(await abandoned.finished).toMatchObject({status: 'cancelled'})
  expect(narrator.enabled).toBe(false)
  detach = attachNarration(narrator, events)
  const next = narrator.push({audio: '/next.opus'})
  await clock.advance(0.1)
  expect(narrator.getSnapshot().current?.id).toBe(next.id)
  expect(players.at(-1)?.playing).toBe(true)
})
test('Escape pauses narration without clearing its queue or the sound preference', async () => {
  // eslint-disable-next-line typescript/no-misused-spread -- Save own timing state for test isolation, not a working clock clone.
  const initial = {...worldTime}
  try {
    const handle = narrator.push({audio: '/voice.opus'})
    await clock.advance(0.1)
    players[0].position = 3
    worldTime.paused = true
    expect(players[0].playing).toBe(false)
    expect(narrator.queue.has(handle.id)).toBe(true)
    expect(narrator.enabled).toBe(true)
    expect(useGallery.getState().sound).toBe(true)
    await clock.advance(60)
    worldTime.paused = false
    await flush()
    expect(players[0].playing).toBe(true)
    expect(players[0].position).toBe(3)
    expect(players[0].disposals).toBe(0)
    worldTime.paused = true
    useGallery.setState({sound: false})
    const result = await handle.finished
    expect(result.status).toBe('cancelled')
    worldTime.paused = false
    expect(narrator.enabled).toBe(false)
  } finally {
    worldTime.paused = false
    Object.assign(worldTime, initial)
  }
})
