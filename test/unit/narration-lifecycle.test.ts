import {afterEach, beforeEach, expect, test} from 'bun:test'

import {Narrator} from 'use-narrator/core'

import {FakeClock, FakePlayback, flush} from '../../packages/use-narrator/packages/use-audio-queue/test/helpers.ts'
import {attachNarration} from '../../src/lib/audio/narration.ts'
import {galleryEvents} from '../../src/lib/gallery/actions.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import worldClock from '../../src/lib/worldClock.ts'
import samplePortraits from './fixtures/portraits.ts'

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
test('a frozen world holds the narrator mid-word, and it speaks on from there once the world goes on', async () => {
  const handle = narrator.push({audio: '/voice.opus'})
  await clock.advance(0.1)
  players[0].position = 2.5
  const release = worldClock.freeze()
  try {
    expect(narrator.paused).toBe(true)
    expect(players[0].playing).toBe(false)
    expect(useGallery.getState().narration).toMatchObject({status: 'playing'})
    await clock.advance(30)
    expect(players[0].playing).toBe(false)
    // A narration asked for during the pause waits its turn in silence.
    narrator.push({audio: '/later.opus'})
    await clock.advance(1)
    expect(players).toHaveLength(1)
  } finally {
    release()
  }
  await flush()
  expect(narrator.paused).toBe(false)
  expect(players[0].playing).toBe(true)
  expect(players[0].position).toBe(2.5)
  players[0].end()
  await clock.advance(0.2)
  expect(await handle.finished).toEqual({status: 'completed'})
  await clock.advance(0.1)
  expect(players[1].playing).toBe(true)
})
test('a narrator attached during a pause starts out held, and detaching lets go of it', async () => {
  detach()
  const release = worldClock.freeze()
  try {
    detach = attachNarration(narrator, events)
    expect(narrator.paused).toBe(true)
    narrator.push({audio: '/voice.opus'})
    await clock.advance(1)
    expect(players[0].plays).toBe(0)
    detach()
    expect(narrator.paused).toBe(false)
  } finally {
    release()
  }
  detach = attachNarration(narrator, events)
  expect(narrator.paused).toBe(false)
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
test('listening marks only the portrait whose narration actually starts, not a queued or canceled story', async () => {
  const original = useGallery.getState().portraits
  const portraits = samplePortraits.slice(0, 2).map(portrait => ({...portrait}))
  useGallery.setState({portraits})
  const interacted = () => useGallery.getState().portraits.map(portrait => portrait.interacted === true)
  try {
    const first = narrator.push({
      audio: '/first.opus',
      title: 'First',
    }, {id: portraits[0].id})
    const second = narrator.push({
      audio: '/second.opus',
      title: 'Second',
    }, {id: portraits[1].id})
    await flush()
    expect(interacted()).toEqual([false, false])
    await clock.advance(0.1)
    expect(interacted()).toEqual([true, false])
    second.cancel()
    narrator.stop()
    await first.finished
    expect(interacted()).toEqual([true, false])
  } finally {
    useGallery.setState({portraits: original})
  }
})
