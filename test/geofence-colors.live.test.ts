import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

/** Look north along the Lobby’s west floor edge, 2 m to the left and 1.82 m below the eye. At 90° vertical FOV the projection scale is half the frame height. */
const edgeColors = (page: Page) => page.evaluate(async () => {
  const {pixels, width, height} = await globalThis.slopGallery!.capturePixels!()
  const sample = (depth: number, color: 'blue' | 'red') => {
    const scale = height / (2 * depth)
    const x = Math.round(width / 2 - 2 * scale)
    const y = Math.round(height / 2 + 1.82 * scale)
    // Pick up the line even if rasterization puts it in the neighboring column.
    let strongest = -255
    for (let column = x - 2; column <= x + 2; column++) {
      const i = 4 * (y * width + column)
      const redMinusBlue = pixels[i] - pixels[i + 2]
      strongest = Math.max(strongest, color === 'red' ? redMinusBlue : -redMinusBlue)
    }
    return strongest
  }
  return {
    near: sample(6, 'red'),
    nearBlue: sample(12, 'blue'),
    farBlue: sample(24, 'blue'),
  }
})
test.skipIf(Bun.env.LIVE_TEST !== 'true')('the occupied fence shows red and the neighboring blue fence fades along its floor edge over a Heavy frame', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    seed: '0',
    graphics: 'heavy',
    room: 'lobby',
    world_reach: 'room',
    show_fence: '{lobby-south,lobby-middle}',
    line_width: '600', // about two render pixels at this size, so a sample includes the center of the antialiased stroke
    width: '800',
    height: '420',
    warmup_scale: 'false',
    frozen_time: '2',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-geofence-colors'})
  const {page} = gallery
  await page.evaluate(() => globalThis.slopGallery!.fly!({
    position: [-6, 1.62, 6.5],
    rotation: [0, 0, 0],
    fov: 90,
  }))
  await waitForFrames(page, 8)
  await waitForLoadingItems(page)
  await waitForFrames(page, 8)
  const shown = await edgeColors(page)
  await callWebmcpTool(page, 'show_fence', {fence: false})
  await waitForFrames(page, 8)
  const hidden = await edgeColors(page)
  const nearBlue = shown.nearBlue - hidden.nearBlue
  const farBlue = shown.farBlue - hidden.farBlue
  expect(shown.near - hidden.near).toBeGreaterThan(100)
  expect(nearBlue - farBlue).toBeGreaterThan(30)
  expect(farBlue).toBeGreaterThan(25)
}, 180_000)
