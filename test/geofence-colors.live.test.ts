import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

/** Count display-red and display-blue pixels, not the colors assigned to the materials. */
const outlinePixels = (page: Page) => page.evaluate(async () => {
  const {pixels} = await globalThis.slopGallery!.capturePixels!()
  let red = 0
  let blue = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 1] !== 0) {
      continue
    }
    if (pixels[i] === 255 && pixels[i + 2] === 0) {
      red++
    } else if (pixels[i] === 0 && pixels[i + 2] === 255) {
      blue++
    }
  }
  return {
    red,
    blue,
  }
})
test.skipIf(Bun.env.LIVE_TEST !== 'true')('occupied and unoccupied fences keep their display colors over a Heavy frame', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    seed: '0',
    graphics: 'heavy',
    room: 'lobby',
    world_reach: 'room',
    show_fence: '{lobby,exhibition}',
    width: '800',
    height: '420',
    warmup_scale: 'false',
    frozen_time: '2',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-geofence-colors'})
  const {page} = gallery
  await page.evaluate(() => globalThis.slopGallery!.fly!({
    position: [-7.26, 1.62, -1],
    rotation: [0.008, -0.69, 0],
  }))
  await waitForFrames(page, 8)
  const shown = await outlinePixels(page)
  await callWebmcpTool(page, 'show_fence', {fence: false})
  await waitForFrames(page, 8)
  const hidden = await outlinePixels(page)
  expect(shown.red - hidden.red).toBeGreaterThan(100)
  expect(shown.blue - hidden.blue).toBeGreaterThan(100)
}, 180_000)
