import type {GalleryDiagnostics} from '../src/lib/diagnostics.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {Euler, Quaternion} from 'three/webgpu'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

const id = 'prop-orb-spook'
type ReleaseWindow = typeof globalThis & {
  itemRelease?: GalleryDiagnostics
  releaseVelocity?: {
    x: number
    y: number
    z: number
  }
}
const snapshot = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const prepare = async (page: Page) => {
  await page.waitForFunction(() => globalThis.slopGallery?.snapshot?.().ready && globalThis.slopGallery.snapshot().loadingItems.length === 0 && globalThis.slopGallery.player?.grounded)
  await page.waitForSelector('#enter-gallery:not([disabled])')
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
  const initial = await snapshot(page)
  const prop = initial.props.find(candidate => candidate.id === id)!
  const aim = Math.atan2(prop.position.y - 1.62, 0.9)
  await page.evaluate(({pitch, position}) => globalThis.slopGallery!.teleport!([position.x, 1.64, position.z + 0.9], [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)]), {
    pitch: aim,
    position: prop.position,
  })
  await page.waitForFunction(propId => globalThis.slopGallery!.snapshot!().active === propId, {}, id)
  await page.mouse.down()
  await page.waitForFunction(propId => globalThis.slopGallery!.snapshot!().held === propId, {}, id)
  await page.evaluate(() => globalThis.slopGallery!.teleport!([0, 1.64, 1], [0, 0, 0, 1]))
  await waitForFrames(page, 12)
}
/** Capture the same input turn as the release, before any physics tick can change its velocity. */
const watchRelease = (page: Page, throwing: boolean) => page.evaluate(isThrow => {
  const host = globalThis as ReleaseWindow
  delete host.itemRelease
  const event = isThrow ? 'keydown' : 'mouseup'
  const record = (input: Event) => {
    if (isThrow && (input as KeyboardEvent).code !== 'KeyQ' || !isThrow && (input as MouseEvent).button !== 0) {
      return
    }
    host.itemRelease = globalThis.slopGallery!.snapshot!()
    host.releaseVelocity = globalThis.slopGallery!.dump!()!.player.velocity
    globalThis.removeEventListener(event, record)
  }
  globalThis.addEventListener(event, record)
}, throwing)
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production input: stationary, sprinting, jumping, dropping and wall-adjacent releases', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    room: 'cell',
    item: id,
    audio: '0',
    width: '960',
    height: '540',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-item-throwing'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  for (const mode of ['standing', 'sprinting', 'jumping', 'dropping', 'wall', 'pause'] as const) {
    if (mode !== 'standing') {
      await page.reload({waitUntil: 'domcontentloaded'})
    }
    await prepare(page)
    if (mode === 'sprinting' || mode === 'dropping') {
      await page.keyboard.down('ShiftLeft')
      await page.keyboard.down('KeyW')
      await page.waitForFunction(() => globalThis.slopGallery!.dump!()!.player.velocity.z < -7)
    } else if (mode === 'jumping') {
      await page.keyboard.down('Space')
      await page.waitForFunction(() => globalThis.slopGallery!.dump!()!.player.velocity.y > 4, {polling: 'raf'})
    } else if (mode === 'wall') {
      // The east wall is at x = 9. The orb retracts into the player’s capsule, which used to return it to the pedestal.
      await page.evaluate(() => globalThis.slopGallery!.teleport!([8.4, 1.64, 1], [0, -Math.SQRT1_2, 0, Math.SQRT1_2]))
      await waitForFrames(page, 12)
      const state = await snapshot(page)
      const held = state.props[0]
      expect(held.visualPosition[0]).toBeLessThan(8.75)
    }
    const throwing = mode !== 'dropping' && mode !== 'pause'
    let released: GalleryDiagnostics
    if (mode === 'pause') {
      await page.evaluate(() => document.exitPointerLock())
      await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().frozen)
      released = await snapshot(page)
    } else {
      await watchRelease(page, throwing)
      if (throwing) {
        await page.keyboard.press('KeyQ')
      } else {
        await page.mouse.up()
      }
      released = await page.evaluate(() => (globalThis as ReleaseWindow).itemRelease!)
    }
    expect(released.held).toBeNull()
    const prop = released.props.find(candidate => candidate.id === id)!
    expect(prop.enabled).toBe(true)
    expect(prop.mass).toBeCloseTo(1.8, 4)
    expect(prop.position.z).toBeGreaterThan(-5)
    if (mode === 'standing') {
      expect(prop.velocity.z).toBeCloseTo(-11.3137, 2)
      expect(prop.velocity.y).toBeCloseTo(1.8856, 1)
    } else if (mode === 'sprinting') {
      expect(prop.velocity.z).toBeLessThan(-18)
    } else if (mode === 'jumping') {
      expect(prop.velocity.y).toBeGreaterThan(5)
    } else if (mode === 'dropping') {
      expect(prop.velocity.z).toBeLessThan(-7)
      const carrier = await page.evaluate(() => (globalThis as ReleaseWindow).releaseVelocity!)
      expect(prop.velocity.y).toBeCloseTo(carrier.y, 2)
      expect(prop.velocity.z).toBeCloseTo(carrier.z, 2)
    } else if (mode === 'wall') {
      expect(prop.position.x).toBeGreaterThan(8.4)
      expect(prop.position.x).toBeLessThan(8.75)
      await waitForFrames(page, 20)
      const afterImpact = await snapshot(page)
      expect(afterImpact.props[0].position.x).toBeLessThan(9)
    } else {
      expect(prop.position.z).toBeGreaterThan(0)
      expect(prop.velocity.z).toBeCloseTo(0, 4)
    }
    if (mode !== 'dropping') {
      await page.mouse.up()
    }
    await page.keyboard.up('KeyW')
    await page.keyboard.up('ShiftLeft')
    await page.keyboard.up('Space')
  }
  // The separate portrait path also drops locally, rather than restoring its old wall when there is no hanging target.
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForFunction(() => globalThis.slopGallery?.snapshot?.().ready && globalThis.slopGallery.player?.grounded)
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
  const state = await snapshot(page)
  const work = state.portraits.find(candidate => candidate.wallId === 'cell-west')!
  const position = work.physical!
  const orientation = new Quaternion
  orientation.setFromEuler(new Euler(Math.atan2(position.y - 1.62, 2), Math.PI / 2, 0, 'YXZ'))
  await page.evaluate(({at, rotation}) => globalThis.slopGallery!.teleport!([at.x + 2, 1.64, at.z], rotation), {
    at: position,
    rotation: orientation.toArray(),
  })
  await page.waitForFunction(workId => globalThis.slopGallery!.snapshot!().active === workId, {}, work.id)
  await page.mouse.down()
  await page.waitForFunction(workId => globalThis.slopGallery!.snapshot!().held === workId, {}, work.id)
  await page.evaluate(() => globalThis.slopGallery!.teleport!([0, 1.64, 1], [0, 0, 0, 1]))
  await waitForFrames(page, 12)
  await page.mouse.up()
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().held === null)
  await waitForFrames(page, 3)
  const dropped = await snapshot(page)
  const portrait = dropped.portraits.find(candidate => candidate.id === work.id)!
  expect(portrait.hung).toBe(false)
  expect(portrait.position[0]).toBeCloseTo(0, 2)
  expect(portrait.physical!.x).toBeCloseTo(0, 2)
  expect(portrait.physical!.z).toBeGreaterThan(-1)
  await waitForFrames(page, 100)
  const landed = await snapshot(page)
  expect(landed.portraits.find(candidate => candidate.id === work.id)!.physical!.y).toBeGreaterThan(0)
  expect(errors).toEqual([])
}, 300_000)
