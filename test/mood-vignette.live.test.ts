import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

/** the share of pixels that visibly differ between two captures, in the middle of the view and in the outer quarter of its short side */
type Difference = {
  center: number
  edge: number
}
type Probes = {
  moodShots: {
    difference: (from: string, to: string) => Difference
    take: (name: string) => Promise<void>
  }
}
/** Keeps captures in the page by name and compares them there, so no pixels cross over to the test. */
const installShots = (page: Page) => page.evaluate(() => {
  type Shot = Awaited<ReturnType<NonNullable<NonNullable<typeof globalThis.slopGallery>['capturePixels']>>>
  const shots = new Map<string, Shot>
  Object.assign(globalThis, {moodShots: {
    async take(name: string) {
      shots.set(name, await globalThis.slopGallery!.capturePixels!())
    },
    difference(from: string, to: string) {
      const a = shots.get(from)!
      const b = shots.get(to)!
      const {width, height} = a
      const margin = Math.min(width, height) / 4
      const counts = [0, 0]
      const changed = [0, 0]
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const region = Number(Math.min(x, width - 1 - x, y, height - 1 - y) < margin)
          counts[region]++
          const i = 4 * (y * width + x)
          if ([0, 1, 2].some(channel => Math.abs(a.pixels[i + channel] - b.pixels[i + channel]) > 12)) {
            changed[region]++
          }
        }
      }
      return {
        center: changed[0] / counts[0],
        edge: changed[1] / counts[1],
      }
    },
  }})
})
const take = (page: Page, name: string) => page.evaluate(async shot => {
  await (globalThis as typeof globalThis & Probes).moodShots.take(shot)
}, name)
const difference = (page: Page, from: string, to: string) => page.evaluate((a, b) => (globalThis as typeof globalThis & Probes).moodShots.difference(a, b), from, to)
/** Presses N, which suppresses every mood under `?development` or lets them back in full. */
const toggleMoods = async (page: Page) => {
  await page.evaluate(() => {
    globalThis.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyN',
      bubbles: true,
    }))
  })
  await waitForFrames(page, 20)
}
/** Opens the Cell facing a papered wall, where nothing moves, so nothing but paint tells two captures apart. Without antialiasing, as TRAA’s subpixel jitter moves the wallpaper’s detail too. */
const openCell = async (graphics: string, query: Record<string, string>) => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics,
    room: 'cell',
    anti_aliasing: 'false',
    development: 'true',
    warmup_scale: 'false',
    ...query,
  })
  const gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-mood-vignette'})
  const {page} = gallery
  await page.evaluate(() => globalThis.slopGallery!.pose!({
    position: [0, 1.8, 0],
    rotation: [0, Math.PI / 2, 0],
  }))
  await waitForFrames(page, 20)
  await installShots(page)
  return gallery
}
const live = test.skipIf(Bun.env.LIVE_TEST !== 'true')
// The real output quad and capture bridge, also in Fast without antialiasing, whose pipeline is only the scene and the moods’ screens.
live('Atelier paints only the margins of a portrait view in fast graphics and goes on painting', async () => {
  await using gallery = await openCell('fast', {
    fade: 'false',
    mood: 'paint',
    width: '384',
    height: '640',
  })
  const {page} = gallery
  await toggleMoods(page)
  await take(page, 'plain')
  await toggleMoods(page)
  await take(page, 'arrived')
  // Long enough for strokes to dry and for a brush to come back.
  await Bun.sleep(9000)
  await take(page, 'later')
  await toggleMoods(page)
  await take(page, 'suppressed')
  const paint = await difference(page, 'plain', 'arrived')
  expect(paint.edge).toBeGreaterThan(0.025)
  expect(paint.center).toBeLessThan(0.005)
  const animation = await difference(page, 'arrived', 'later')
  expect(animation.edge).toBeGreaterThan(0.01)
  expect(animation.center).toBeLessThan(0.005)
  const later = await difference(page, 'plain', 'later')
  expect(later.edge).toBeGreaterThan(0.025)
  const suppressed = await difference(page, 'plain', 'suppressed')
  expect(suppressed.edge).toBeLessThan(0.005)
}, 180_000)
live('Atelier paints only the margins of a landscape view in heavy graphics and stands still under ?frozen_time', async () => {
  await using gallery = await openCell('heavy', {
    fade: 'false',
    mood: 'paint',
    frozen_time: '2',
    width: '640',
    height: '384',
  })
  const {page} = gallery
  await toggleMoods(page)
  await take(page, 'plain')
  await toggleMoods(page)
  await take(page, 'arrived')
  await Bun.sleep(3000)
  await take(page, 'later')
  await toggleMoods(page)
  await take(page, 'suppressed')
  const paint = await difference(page, 'plain', 'arrived')
  expect(paint.edge).toBeGreaterThan(0.025)
  expect(paint.center).toBeLessThan(0.005)
  const animation = await difference(page, 'arrived', 'later')
  expect(animation.edge).toBeLessThan(0.005)
  const suppressed = await difference(page, 'plain', 'suppressed')
  expect(suppressed.edge).toBeLessThan(0.005)
}, 180_000)
live('Atelier cast by the cast_mood tool is painted stroke by stroke and dries away once it is let go of', async () => {
  await using gallery = await openCell('fast', {
    width: '640',
    height: '384',
  })
  const {page} = gallery
  await take(page, 'plain')
  const {fade} = await callWebmcpTool(page, 'cast_mood', {mood: 'paint'}) as {fade: {
    in: number
    out: number
  }}
  await Bun.sleep(fade.in * 1000 * 0.3)
  await take(page, 'coming')
  await Bun.sleep(fade.in * 1000)
  await take(page, 'arrived')
  expect(await callWebmcpTool(page, 'cast_mood', {mood: null})).toEqual({mood: null})
  await Bun.sleep(fade.out * 1000 + 500)
  await take(page, 'gone')
  const coming = await difference(page, 'plain', 'coming')
  const arrived = await difference(page, 'plain', 'arrived')
  expect(coming.edge).toBeGreaterThan(0.002)
  expect(coming.edge).toBeLessThan(arrived.edge * 0.8)
  expect(arrived.edge).toBeGreaterThan(0.025)
  expect(arrived.center).toBeLessThan(0.005)
  const gone = await difference(page, 'plain', 'gone')
  expect(gone.edge).toBeLessThan(0.005)
}, 180_000)
