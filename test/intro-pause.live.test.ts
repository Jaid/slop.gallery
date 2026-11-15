import type {GalleryDiagnostics as Snapshot} from '../src/lib/diagnostics.ts'
import type {PlayerDumpSnapshot} from '../src/lib/telemetry/recordPlayerDump.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const dump = async (page: Page): Promise<PlayerDumpSnapshot> => {
  const result = await page.evaluate(() => globalThis.slopGallery!.dump!())
  if (!result) {
    throw new Error('The player gave no dump.')
  }
  return result
}
const menu = (page: Page) => page.evaluate(() => ({
  active: document.querySelector(':focus')?.id,
  button: (document.querySelector('#enter-gallery')?.textContent ?? '').trim(),
  minimap: document.querySelector('[data-testid="minimap"]') !== null,
  stage: document.querySelector('[data-testid="menu-overlay"]')?.getAttribute('data-stage'),
  title: document.querySelector('#menu-title')?.textContent,
  works: document.querySelectorAll('[data-testid="portrait-collection"] [data-portrait]').length,
}))
// Without ?test=true, which leaves the intro out: Escape in the menu after page load jumps straight to the frozen pause menu, with the orbiting camera handed to the player’s body where it circles, and Resume drops that body from there.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: Escape from the intro menu opens the frozen pause menu at the body', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    width: '1280',
    height: '720',
    test: 'false',
    warmup_scale: 'false',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-intro-pause'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.waitForFunction(() => !document.querySelector('#loading-screen'))
  // The physics starts once the rooms still loading behind the ready scene are in; only then has the body at the spawn landed.
  await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
  const opening = await snapshot(page)
  const openingDump = await dump(page)
  const openingMenu = await menu(page)
  expect(['first', 'return']).toContain(opening.menuStage)
  expect(openingMenu).toMatchObject({
    button: 'Play',
    minimap: false,
    stage: opening.menuStage,
    title: 'Slop Gallery',
    works: 0,
  })
  const [spawnX, spawnY, spawnZ] = slopGallery.spawn.position
  expect(openingDump.player.grounded).toBe(true)
  expect(Math.hypot(openingDump.player.position.x - spawnX, openingDump.player.position.z - spawnZ)).toBeLessThan(0.06)
  expect(Math.abs(openingDump.player.position.y - spawnY)).toBeLessThan(0.06)
  // The camera is still circling the fountain, far above and away from that body at the spawn.
  await Bun.sleep(500)
  const orbiting = await snapshot(page)
  expect(Math.hypot(orbiting.camera[0] - opening.camera[0], orbiting.camera[2] - opening.camera[2])).toBeGreaterThan(0.1)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const current = globalThis.slopGallery!.snapshot!()
    return current.menuStage === 'pause' && current.frozen && !current.locked
  })
  await page.waitForSelector('[data-testid="menu-overlay"][data-stage="pause"] [data-testid="minimap"]')
  await page.waitForFunction(() => document.activeElement?.id === 'menu-title')
  const paused = await snapshot(page)
  const pausedDump = await dump(page)
  const pausedMenu = await menu(page)
  expect(pausedMenu).toEqual({
    active: 'menu-title',
    button: 'Resume',
    minimap: true,
    stage: 'pause',
    title: 'Lobby',
    works: paused.portraits.length,
  })
  // The body took the orbiting camera’s place: its feet an eye height below the unchanged view, in the air over the Lobby floor.
  const feet = pausedDump.player.position
  expect(pausedDump.player.grounded).toBe(false)
  expect(Math.hypot(feet.x - paused.camera[0], feet.z - paused.camera[2])).toBeLessThan(0.01)
  expect(Math.abs(paused.camera[1] - feet.y - defaultEgoOptions.eyeHeight)).toBeLessThan(0.01)
  expect(Math.hypot(feet.x - spawnX, feet.z - spawnZ)).toBeGreaterThan(1)
  const fall = feet.y - slopGallery.floorHeight([feet.x, feet.y, feet.z])
  expect(fall).toBeGreaterThanOrEqual(2)
  expect(fall).toBeLessThanOrEqual(2.5)
  // Frozen there: a second under the menu moves neither the view nor the body.
  await Bun.sleep(1000)
  const still = await snapshot(page)
  const stillDump = await dump(page)
  expect(still.frozen).toBe(true)
  expect(still.camera).toEqual(paused.camera)
  expect(stillDump.player.position).toEqual(feet)
  // Resume enters at that body, which falls straight to the floor below it.
  await page.waitForSelector('#enter-gallery:not([disabled])')
  await page.click('#enter-gallery')
  await page.waitForFunction(() => Boolean(document.pointerLockElement) && globalThis.slopGallery!.snapshot!().locked && !globalThis.slopGallery!.snapshot!().frozen)
  await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true)
  const landedDump = await dump(page)
  const landed = landedDump.player
  expect(landed.grounded).toBe(true)
  expect(Math.hypot(landed.position.x - feet.x, landed.position.z - feet.z)).toBeLessThan(0.01)
  expect(Math.abs(landed.position.y - slopGallery.floorHeight([landed.position.x, landed.position.y, landed.position.z]))).toBeLessThan(0.06)
  expect(errors).toEqual([])
}, 180_000)
