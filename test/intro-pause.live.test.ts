import type {GalleryDiagnostics} from '../src/lib/diagnostics.ts'
import type {PlayerDumpSnapshot} from '../src/lib/telemetry/recordPlayerDump.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames, waitForGallery} from '../scripts/lib/headlessGallery.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

type Counters = {
  audio: Array<{
    state: AudioContextState
    time: number
  }>
  exits: number
  frames: number
  /** how many frames had been drawn when the world was first seen frozen, if it was yet */
  framesAtFreeze?: number
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
/** where the body’s feet are, once there is a body */
const feetOf = (page: Page) => page.evaluate(() => globalThis.slopGallery!.dump!()?.player.position)
const enter = async (page: Page) => {
  await page.click('#enter-gallery')
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().locked && !globalThis.slopGallery!.snapshot!().frozen)
}
/** Records the pose on both sides of the actual key handler, before a frame could move the camera. */
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
const orbit = slopGallery.introOrbit
/** How far the camera is off the intro’s ring around the fountain, in meters, sideways and in height: 0 while it circles there, wherever the player turned it. */
const offRing = ([x, y, z]: GalleryDiagnostics['camera']) => Math.hypot(Math.hypot(x - orbit.target[0], z - orbit.target[2]) - orbit.radius, y - orbit.target[1] - orbit.elevation)
/** Checks the frozen pause menu over a menu before the game: nothing runs at rest, and neither Escape nor the intro’s turn controls change that, even through a resize’s zero-time redraws. Returns the camera it rests at. */
const restFrozen = async (page: Page, before: Counters) => {
  expect(await page.$eval('#enter-gallery', element => element.textContent)).toBe('Resume')
  // Streaming and the zero-time redraws it asks for may finish, but the world must come to rest.
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().loadingItems.length === 0, {timeout: 240_000})
  await Bun.sleep(1000)
  const still = await snapshot(page)
  const counts = await counters(page)
  const feet = await feetOf(page)
  await Bun.sleep(700)
  const later = await counters(page)
  expect(later.locks).toBe(before.locks)
  expect(later.exits).toBe(before.exits)
  expect(later.frames).toBe(counts.frames)
  expect(later.audio).toEqual(counts.audio)
  expect(later.audio.every(context => context.state === 'suspended')).toBe(true)
  const frozen = await snapshot(page)
  expect(frozen.frozen).toBe(true)
  expect(frozen.locked).toBe(false)
  expect(frozen.menuStage).toBe('pause')
  expect(frozen.camera).toEqual(still.camera)
  expect(await feetOf(page)).toEqual(feet)
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
  expect(redrawn.rotation).toEqual(still.rotation)
  expect(redrawn.frozen).toBe(true)
  expect(redrawn.menuStage).toBe('pause')
  const redrawnCounts = await counters(page)
  expect(redrawnCounts.locks).toBe(before.locks)
  return still.camera
}
/** Resumes the frozen pause menu and plays on from there. Over the intro’s orbit, Resume only gives the intro’s menu of the stage back, behind which the camera circles on from where it stood, and Play enters; without the orbit, Resume enters right away. */
const resume = async (page: Page, stage: 'first' | 'return', orbital: boolean, still: GalleryDiagnostics['camera'], before: Counters) => {
  const {frames: frozenFrames} = await counters(page)
  if (orbital) {
    const [spawnX, , spawnZ] = slopGallery.spawn.position
    await page.click('#enter-gallery')
    await page.waitForSelector(`[data-testid="menu-overlay"][data-stage="${stage}"] #enter-gallery:not([disabled])`)
    expect(await page.$eval('#enter-gallery', element => element.textContent)).toBe('Play')
    await page.waitForFunction(() => document.activeElement?.id === 'menu-title')
    const back = await snapshot(page)
    expect(back.frozen).toBe(false)
    expect(back.locked).toBe(false)
    // It goes on from where it stood, on its ring, instead of jumping or handing the camera to the body.
    expect(Math.hypot(...back.camera.map((value, axis) => value - still[axis]))).toBeLessThan(1.5)
    await page.waitForFunction(([x, , z]) => {
      const {camera} = globalThis.slopGallery!.snapshot!()
      return Math.hypot(camera[0] - x, camera[2] - z) > 0.2
    }, {}, still)
    const circling = await snapshot(page)
    expect(offRing(circling.camera)).toBeLessThan(0.02)
    expect(circling.menuStage).toBe(stage)
    const counts = await counters(page)
    expect(counts.frames).toBeGreaterThan(frozenFrames)
    expect(counts.locks).toBe(before.locks)
    expect(counts.exits).toBe(before.exits)
    // The body never left the spawn. It lands there once the physics run, which under ?paused froze with the world before they did.
    await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
    const spawned = (await feetOf(page))!
    expect(Math.hypot(spawned.x - spawnX, spawned.z - spawnZ)).toBeLessThan(0.06)
    // The intro’s menu pauses again just the same.
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().frozen)
    await page.click('#enter-gallery')
    await page.waitForFunction(menuStage => !globalThis.slopGallery!.snapshot!().frozen && globalThis.slopGallery!.snapshot!().menuStage === menuStage, {}, stage)
    const again = await snapshot(page)
    expect(again.locked).toBe(false)
  }
  await enter(page)
  await waitForFrames(page, 90)
  const counts = await counters(page)
  expect(counts.frames).toBeGreaterThan(frozenFrames)
  expect(counts.locks).toBe(before.locks + 1)
  if (orbital) {
    // Play drops the body straight down from the camera on its ring.
    await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true)
    const landed = (await feetOf(page))!
    expect(Math.abs(Math.hypot(landed.x - orbit.target[0], landed.z - orbit.target[2]) - orbit.radius)).toBeLessThan(0.05)
    expect(Math.abs(landed.y - slopGallery.floorHeight([landed.x, landed.y, landed.z]))).toBeLessThan(0.06)
    const played = await snapshot(page)
    expect(played.camera[0]).toBeCloseTo(landed.x, 2)
    expect(played.camera[2]).toBeCloseTo(landed.z, 2)
    expect(counts.audio.some(context => context.state === 'running')).toBe(true)
  }
  // Losing focus after playing keeps its original nonfreezing behavior, even after the direct-pause route.
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
const pauseFromIntro = async (page: Page, stage: 'first' | 'return', orbital: boolean) => {
  await page.waitForSelector(`[data-testid="menu-overlay"][data-stage="${stage}"] #enter-gallery:not([disabled])`)
  // The physics starts once the rooms still loading behind the ready scene are in; only then has the body at the spawn landed.
  await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
  const running = await snapshot(page)
  expect(running.frozen).toBe(false)
  expect(running.locked).toBe(false)
  const beforeCounts = await counters(page)
  const spawned = (await feetOf(page))!
  if (orbital) {
    // The camera circles the fountain, far above and away from the body standing at the spawn.
    const [spawnX, , spawnZ] = slopGallery.spawn.position
    expect(Math.hypot(spawned.x - spawnX, spawned.z - spawnZ)).toBeLessThan(0.06)
    await Bun.sleep(200)
    const turned = await snapshot(page)
    expect(turned.camera).not.toEqual(running.camera)
    expect(offRing(turned.camera)).toBeLessThan(0.02)
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
  // Nothing takes the camera over: it stays where it was, on the intro’s ring, and the body at the spawn.
  expect(takeover.after.camera).toEqual(takeover.before.camera)
  expect(takeover.after.rotation).toEqual(takeover.before.rotation)
  expect(Math.hypot(takeover.body!.position.x - spawned.x, takeover.body!.position.y - spawned.y, takeover.body!.position.z - spawned.z)).toBeLessThan(0.001)
  const still = await restFrozen(page, beforeCounts)
  expect(still).toEqual(takeover.before.camera)
  await resume(page, stage, orbital, still, beforeCounts)
}
/** Opens the page with `?paused`, which starts under the pause menu instead of the menu of the stage: frozen from the moment the world is ready, whatever still streams in arriving behind it. */
const startPaused = async (page: Page, stage: 'first' | 'return', room?: string) => {
  const url = new URL(page.url())
  url.searchParams.set('paused', 'true')
  if (room) {
    url.searchParams.set('room', room)
  } else {
    url.searchParams.delete('room')
  }
  await page.goto(url.href, {waitUntil: 'domcontentloaded'})
  await waitForGallery(page, {fly: false})
  await page.waitForFunction(() => !document.querySelector('#loading-screen'))
  await page.waitForSelector('[data-testid="menu-overlay"][data-stage="pause"] [data-testid="minimap"]')
  const paused = await snapshot(page)
  expect(paused.frozen).toBe(true)
  expect(paused.locked).toBe(false)
  const beforeCounts = await counters(page)
  expect(beforeCounts.locks).toBe(0)
  // The world froze the moment it got ready, and what was left to stream in then still gets its frames.
  await page.waitForFunction(() => {
    const {frames, framesAtFreeze} = (globalThis as typeof globalThis & Probes).introPauseCounters()
    return framesAtFreeze !== undefined && frames - framesAtFreeze > 5
  }, {timeout: 20_000})
  const still = await restFrozen(page, beforeCounts)
  if (!room) {
    expect(offRing(still)).toBeLessThan(0.02)
  }
  await resume(page, stage, !room, still, beforeCounts)
}
for (const graphics of ['fast', 'heavy']) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`production gallery: Escape and ?paused go directly from intro to frozen pause and back (${graphics})`, async () => {
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
        let framesAtFreeze: number | undefined
        const watchFreeze = () => {
          if (globalThis.slopGallery?.snapshot?.().frozen) {
            framesAtFreeze = frames
          } else {
            requestAnimationFrame(watchFreeze)
          }
        }
        requestAnimationFrame(watchFreeze)
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
          framesAtFreeze,
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
    // ?paused starts there, over the intro’s orbit and without it.
    await startPaused(page, 'return')
    await startPaused(page, 'return', 'oculus')
    expect(errors).toEqual([])
  }, 900_000)
}
