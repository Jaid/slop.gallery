import type {GalleryDiagnostics} from '../src/lib/diagnostics.ts'
import type {PlayerDumpSnapshot} from '../src/lib/telemetry/recordPlayerDump.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames, waitForGallery} from '../scripts/lib/headlessGallery.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

type Counters = {
  audio: Array<{
    state: AudioContextState
    time: number
  }>
  exits: number
  frames: number
  locks: number
}
type Takeover = {
  after: GalleryDiagnostics
  before: GalleryDiagnostics
  body?: PlayerDumpSnapshot['player']
}
type Probes = {
  introPauseCounters: () => Counters
  introPauseTakeover?: Takeover
}
const snapshot = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const counters = (page: Page) => page.evaluate(() => (globalThis as typeof globalThis & Probes).introPauseCounters())
const body = (page: Page) => page.evaluate(() => globalThis.slopGallery!.dump!()?.player)
const enter = async (page: Page) => {
  await page.click('#enter-gallery')
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().locked && !globalThis.slopGallery!.snapshot!().frozen)
}
/** Records the pose on both sides of the actual key handler, before a frame could step the physics or move the camera. */
const recordTakeover = (page: Page) => page.evaluate(() => {
  let before: GalleryDiagnostics
  globalThis.addEventListener('keydown', () => {
    before = globalThis.slopGallery!.snapshot!()
  }, {
    capture: true,
    once: true,
  })
  globalThis.addEventListener('keydown', () => {
    const api = globalThis.slopGallery!
    Object.assign(globalThis, {introPauseTakeover: {
      before,
      after: api.snapshot!(),
      body: api.dump!()?.player,
    }})
  }, {once: true})
})
const pauseFromIntro = async (page: Page, stage: 'first' | 'return', orbital: boolean) => {
  await page.waitForSelector(`[data-testid="menu-overlay"][data-stage="${stage}"] #enter-gallery:not([disabled])`)
  // The physics starts once the rooms still loading behind the ready scene are in; only then has the body at the spawn landed.
  await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
  const running = await snapshot(page)
  expect(running.frozen).toBe(false)
  expect(running.locked).toBe(false)
  const beforeCounts = await counters(page)
  if (orbital) {
    // The camera circles the fountain, far above and away from the body standing at the spawn.
    const [spawnX, , spawnZ] = slopGallery.spawn.position
    const spawned = (await body(page))!
    expect(Math.hypot(spawned.position.x - spawnX, spawned.position.z - spawnZ)).toBeLessThan(0.06)
    await Bun.sleep(200)
    const turned = await snapshot(page)
    expect(turned.camera).not.toEqual(running.camera)
  }
  // A handled Escape, held key, modified shortcut or text input is not the menu shortcut.
  const ignoredStage = await page.evaluate(() => {
    const send = (options: KeyboardEventInit, target: EventTarget = globalThis, prevented = false) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Escape',
        ...options,
      })
      if (prevented) {
        event.preventDefault()
      }
      target.dispatchEvent(event)
    }
    for (const options of [{repeat: true}, {ctrlKey: true}, {metaKey: true}, {altKey: true}]) {
      send(options)
    }
    send({}, globalThis, true)
    const input = document.createElement('textarea')
    document.body.append(input)
    send({}, input)
    input.remove()
    return globalThis.slopGallery!.snapshot!().menuStage
  })
  expect(ignoredStage).toBe(stage)
  await recordTakeover(page)
  // No pointer lock exists, so unlike the gameplay Escape test this is the real key, not exitPointerLock().
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-testid="menu-overlay"][data-stage="pause"] [data-testid="minimap"]')
  await page.waitForSelector('[data-testid="portrait-collection"] [data-portrait]')
  // The pause menu replaced the first menu in place, and its heading still takes the focus.
  await page.waitForFunction(() => document.activeElement?.id === 'menu-title')
  const takeover = await page.evaluate(() => (globalThis as typeof globalThis & Probes).introPauseTakeover!)
  expect(takeover.after.frozen).toBe(true)
  expect(takeover.after.locked).toBe(false)
  expect(takeover.after.menuStage).toBe('pause')
  // The camera does not jump when the body takes over; the feet are right below its eyes, in the air over the floor.
  for (const axis of [0, 1, 2] as const) {
    expect(takeover.after.camera[axis]).toBeCloseTo(takeover.before.camera[axis], 5)
    expect(takeover.after.rotation[axis]).toBeCloseTo(takeover.before.rotation[axis], 5)
  }
  if (orbital) {
    const feet = takeover.body!.position
    expect(feet.x).toBeCloseTo(takeover.before.camera[0], 3)
    expect(feet.y).toBeCloseTo(takeover.before.camera[1] - defaultEgoOptions.eyeHeight, 3)
    expect(feet.z).toBeCloseTo(takeover.before.camera[2], 3)
    expect(feet.y - slopGallery.floorHeight([feet.x, feet.y, feet.z])).toBeGreaterThan(1)
  }
  expect(await page.$eval('#enter-gallery', element => element.textContent)).toBe('Resume')
  // Streaming and the zero-time redraw after a teleport may finish, but the world must come to rest.
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().loadingItems.length === 0, {timeout: 120_000})
  await Bun.sleep(1000)
  const still = await snapshot(page)
  const counts = await counters(page)
  const feet = (await body(page))!.position
  await Bun.sleep(700)
  const later = await counters(page)
  expect(later.locks).toBe(beforeCounts.locks)
  expect(later.exits).toBe(beforeCounts.exits)
  expect(later.frames).toBe(counts.frames)
  expect(later.audio).toEqual(counts.audio)
  expect(later.audio.every(context => context.state === 'suspended')).toBe(true)
  const frozen = await snapshot(page)
  expect(frozen.camera).toEqual(still.camera)
  expect((await body(page))!.position).toEqual(feet)
  // Escape again and intro turn controls must not resume or revive the orbit, even through a resize’s zero-time redraws.
  await page.keyboard.press('Escape')
  await page.keyboard.down('d')
  const viewport = page.viewport()!
  await page.setViewport({
    ...viewport,
    width: viewport.width - 16,
  })
  await Bun.sleep(700)
  await page.keyboard.up('d')
  const redrawn = await snapshot(page)
  expect(redrawn.camera).toEqual(still.camera)
  expect(redrawn.frozen).toBe(true)
  await enter(page)
  await waitForFrames(page, 90)
  const resumed = await snapshot(page)
  const resumedCounts = await counters(page)
  expect(resumedCounts.frames).toBeGreaterThan(later.frames)
  expect(resumedCounts.locks).toBe(beforeCounts.locks + 1)
  if (orbital) {
    // Resume drops the body straight down from where it hung rather than teleporting to the old spawn or returning to the orbit.
    await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true)
    const landed = (await body(page))!.position
    expect(Math.hypot(landed.x - feet.x, landed.z - feet.z)).toBeLessThan(0.01)
    expect(Math.abs(landed.y - slopGallery.floorHeight([landed.x, landed.y, landed.z]))).toBeLessThan(0.06)
    expect(resumed.camera[0]).toBeCloseTo(still.camera[0], 3)
    expect(resumed.camera[2]).toBeCloseTo(still.camera[2], 3)
    expect(resumed.camera[1]).toBeLessThan(still.camera[1] - 1)
    expect(resumedCounts.audio.some(context => context.state === 'running')).toBe(true)
  }
  // Losing focus after Resume keeps its original nonfreezing behavior, even after the new direct-pause route.
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('blur'))
    document.exitPointerLock()
  })
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'unfocus' && !globalThis.slopGallery!.snapshot!().locked)
  const unfocused = await snapshot(page)
  expect(unfocused.frozen).toBe(false)
  await page.keyboard.press('Escape')
  const escaped = await snapshot(page)
  expect(escaped.menuStage).toBe('unfocus')
  expect(escaped.frozen).toBe(false)
}
for (const graphics of ['fast', 'heavy']) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`production gallery: Escape goes directly from intro to frozen pause (${graphics})`, async () => {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics,
      width: '1280',
      height: '720',
      // ?test=true deliberately leaves the intro out; diagnostics except teleport and fly are there without it.
      test: 'false',
      warmup_scale: 'false',
    })
    await using gallery = await openHeadlessGallery(setup, {
      cacheDir: 'node_modules/.vite-intro-pause',
      initScripts: [() => {
        let frames = 0
        let locks = 0
        let exits = 0
        const contexts: Array<AudioContext> = []
        globalThis.AudioContext = class extends AudioContext {
          constructor(options?: AudioContextOptions) {
            super(options)
            contexts.push(this)
          }
        }
        // eslint-disable-next-line typescript/unbound-method -- called with the context as this
        const texture = GPUCanvasContext.prototype.getCurrentTexture
        GPUCanvasContext.prototype.getCurrentTexture = function () {
          frames++
          return texture.call(this)
        }
        // eslint-disable-next-line typescript/unbound-method -- called with the element as this
        const request = HTMLElement.prototype.requestPointerLock
        HTMLElement.prototype.requestPointerLock = function (options) {
          locks++
          return request.call(this, options)
        }
        const exit = document.exitPointerLock.bind(document)
        document.exitPointerLock = () => {
          exits++
          exit()
        }
        Object.assign(globalThis, {introPauseCounters: () => ({
          frames,
          locks,
          exits,
          audio: contexts.map(context => ({
            state: context.state,
            time: context.currentTime,
          })),
        })})
      }],
    })
    const {page} = gallery
    const errors: Array<string> = []
    page.on('pageerror', error => errors.push(String(error)))
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
    await page.waitForFunction(() => !document.querySelector('#loading-screen'))
    await pauseFromIntro(page, 'first', true)
    // A saved visit uses the same shortcut; then a URL without an orbital intro does too.
    for (const room of [undefined, 'oculus']) {
      const url = new URL(page.url())
      if (room) {
        url.searchParams.set('room', room)
      }
      await page.goto(url.href, {waitUntil: 'domcontentloaded'})
      await waitForGallery(page, {fly: false})
      await page.waitForFunction(() => !document.querySelector('#loading-screen'))
      await pauseFromIntro(page, 'return', room === undefined)
    }
    expect(errors).toEqual([])
  }, 360_000)
}
