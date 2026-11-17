import type {GalleryDiagnostics} from '../src/lib/diagnostics.ts'
import type {Vec3} from '../src/lib/gallery/types.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

const snapshot = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!())
type Probe = {
  after: GalleryDiagnostics
  before: GalleryDiagnostics
  velocity: {
    x: number
    y: number
    z: number
  }
}
type ProbedWindow = typeof globalThis & {releaseProbe: Probe}
/** Observe the real input handler synchronously, before physics can damp or bounce the released body. */
const recordRelease = (page: Page, event: 'keydown' | 'mouseup') => page.evaluate(type => {
  let before: GalleryDiagnostics
  let velocity: Probe['velocity']
  globalThis.addEventListener(type, () => {
    before = globalThis.slopGallery!.snapshot!()
    velocity = globalThis.slopGallery!.dump!()!.player.velocity
  }, {
    capture: true,
    once: true,
  })
  globalThis.addEventListener(type, () => {
    (globalThis as ProbedWindow).releaseProbe = {
      before,
      velocity,
      after: globalThis.slopGallery!.snapshot!(),
    }
  }, {once: true})
}, event)
const probe = (page: Page) => page.evaluate(() => (globalThis as ProbedWindow).releaseProbe)
const teleport = async (page: Page, position: Vec3, yaw = 0, pitch = 0) => {
  const sy = Math.sin(yaw / 2)
  const cy = Math.cos(yaw / 2)
  const sp = Math.sin(pitch / 2)
  const cp = Math.cos(pitch / 2)
  await page.evaluate((p, q) => globalThis.slopGallery!.teleport!(p, q), position, [cy * sp, sy * cp, -sy * sp, cy * cp])
  await waitForFrames(page, 20)
}
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production throwing: local wall drop, sprint, rising jump, moving drop and interruption', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    item: 'prop-orb-transparent',
    width: '800',
    height: '450',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-throwing'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.click('#enter-gallery')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  const grab = async (id: string) => {
    await teleport(page, [0, 1.62, -8.2], 0, -Math.atan2(0.1, 1.3))
    await page.waitForFunction(prop => globalThis.slopGallery!.snapshot!().active === prop, {}, id).catch(async error => {
      console.error(JSON.stringify(await snapshot(page)))
      throw error
    })
    await page.mouse.down()
    await page.waitForFunction(prop => globalThis.slopGallery!.snapshot!().held === prop, {}, id)
    await waitForFrames(page, 3)
  }
  const id = 'prop-orb-transparent'
  await grab(id)
  const pickedUp = await snapshot(page)
  const original = pickedUp.props.find(prop => prop.id === id)!.position
  // Press the held orb against the east wall: the only valid release overlaps the player.
  await teleport(page, [8.35, 1.62, 2.5], -Math.PI / 2)
  const againstWall = await snapshot(page)
  const held = againstWall.props.find(prop => prop.id === id)!
  expect(held.visualPosition[0]).toBeGreaterThan(8.5)
  expect(held.visualPosition[0]).toBeLessThan(8.85)
  await recordRelease(page, 'mouseup')
  await page.mouse.up()
  const dropped = await probe(page)
  const local = dropped.after.props.find(prop => prop.id === id)!
  expect(dropped.after.held).toBeNull()
  expect(local.enabled).toBe(true)
  expect(local.mass).toBeCloseTo(1.8, 5)
  expect(local.position.x).toBeCloseTo(held.visualPosition[0], 3)
  expect(Math.hypot(local.position.x - original.x, local.position.z - original.z)).toBeGreaterThan(8)
  expect(local.collisionGroups[0] & 0x80_00).toBe(0)
  await waitForFrames(page, 45)
  const settled = await snapshot(page)
  expect(settled.props.find(prop => prop.id === id)!.position.x).toBeGreaterThan(8)
  // Step away so the dropped body can regain player collisions without an overlap kick.
  await page.keyboard.down('s')
  await page.waitForFunction(() => globalThis.slopGallery!.player!.position.x < 7.5)
  await page.keyboard.up('s')
  await waitForFrames(page, 25)
  const separated = await snapshot(page)
  expect(separated.props.find(prop => prop.id === id)!.collisionGroups[0] & 0x80_00).not.toBe(0)
  const results: Record<string, Probe> = {}
  for (const kind of ['standing', 'sprint', 'jump', 'moving-drop', 'interrupted']) {
    const prop = `prop-throw-${kind}`
    await callWebmcpTool(page, 'spawn_orb', {
      orb: 'transparent',
      position: [0, 1.53, -9.5],
      id: prop,
    })
    await grab(prop)
    await teleport(page, [0, 1.62, 2])
    if (kind === 'sprint') {
      await page.keyboard.down('ShiftLeft')
      await page.keyboard.down('w')
      await page.waitForFunction(() => globalThis.slopGallery!.dump!()!.player.velocity.z < -7)
    } else if (kind === 'jump') {
      await page.keyboard.down('Space')
      await page.waitForFunction(() => globalThis.slopGallery!.dump!()!.player.velocity.y > 3)
    } else if (kind === 'moving-drop') {
      await page.keyboard.down('w')
      await page.waitForFunction(() => globalThis.slopGallery!.dump!()!.player.velocity.z < -2)
    }
    const drop = kind === 'moving-drop'
    await recordRelease(page, drop ? 'mouseup' : 'keydown')
    if (drop) {
      await page.mouse.up()
    } else if (kind === 'interrupted') {
      // Escape’s carry interruption drops locally too, instead of restoring the pickup pose.
      await page.evaluate(() => globalThis.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape'})))
    } else {
      await page.keyboard.press('q')
    }
    results[kind] = await probe(page)
    expect(results[kind].after.held).toBeNull()
    if (!drop) {
      await page.mouse.up()
    }
    for (const key of ['w', 'ShiftLeft', 'Space'] as const) {
      await page.keyboard.up(key)
    }
    await waitForFrames(page, 10)
    // Keep earlier throws out of the next pickup’s sightline.
    if (kind !== 'interrupted') {
      await callWebmcpTool(page, 'throw_prop', {
        prop,
        from: [5, 0.5, 0],
        velocity: [0, 0, 0],
      })
    }
  }
  const thrown = (kind: string) => results[kind].after.props.find(prop => prop.id === `prop-throw-${kind}`)!
  expect(thrown('standing').velocity.z).toBeCloseTo(-10, 1)
  expect(thrown('sprint').velocity.z).toBeLessThan(-18)
  expect(thrown('jump').velocity.y).toBeGreaterThan(5)
  expect(thrown('moving-drop').velocity.z).toBeLessThan(-2)
  expect(thrown('moving-drop').velocity.z).toBeCloseTo(results['moving-drop'].velocity.z, 0)
  expect(thrown('interrupted').position.z).toBeGreaterThan(0)
  expect(errors).toEqual([])
}, 180_000)
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production portraits: an oversized blocked throw stays held, and a failed wall placement drops locally', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    room: 'cell',
    width: '800',
    height: '450',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-throwing'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.click('#enter-gallery')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  const grab = async (id: string, x: number, yaw: number) => {
    await teleport(page, [x, 1.62, 0], yaw, Math.atan2(0.48, 1.78))
    await page.waitForFunction(target => globalThis.slopGallery!.snapshot!().active === target, {}, id)
    await page.mouse.down()
    await page.waitForFunction(target => globalThis.slopGallery!.snapshot!().held === target, {}, id)
  }
  await grab('frog', 7, -Math.PI / 2)
  await teleport(page, [8.35, 1.62, 2.5])
  await page.keyboard.press('q')
  const blocked = await snapshot(page)
  expect(blocked.held).toBe('frog')
  expect(blocked.portraits.find(portrait => portrait.id === 'frog')!.hung).toBe(true)
  await teleport(page, [0, 1.62, 2])
  await page.keyboard.press('q')
  const thrown = await snapshot(page)
  expect(thrown.held).toBeNull()
  const frog = thrown.portraits.find(portrait => portrait.id === 'frog')!
  expect(frog.hung).toBe(false)
  expect(frog.position[0]).toBeCloseTo(0, 2)
  expect(frog.position[2]).toBeGreaterThan(0)
  await page.mouse.up()
  await grab('tree', -7, Math.PI / 2)
  await teleport(page, [0, 1.62, 2])
  // The north wall is too far away to hang it: this used to silently put it back on the west wall.
  await page.mouse.up()
  const dropped = await snapshot(page)
  const tree = dropped.portraits.find(portrait => portrait.id === 'tree')!
  expect(dropped.held).toBeNull()
  expect(tree.hung).toBe(false)
  expect(tree.position[0]).toBeCloseTo(0, 2)
  expect(tree.position[2]).toBeGreaterThan(0)
  expect(errors).toEqual([])
}, 120_000)
