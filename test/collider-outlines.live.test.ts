import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('a collider selected by URL appears on a later spawn and WebMCP changes the next paused capture', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    room: 'studio',
    seed: '0',
    graphics: 'fast',
    portraits: '0',
    paused: 'true',
    show_colliders: 'prop-orb-probe*',
    line_width: '600',
    width: '640',
    height: '360',
    warmup_scale: 'false',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-collider-outlines'})
  const {page} = gallery
  await page.evaluate(() => globalThis.slopGallery!.fly!({
    position: [4, 2, 6],
    rotation: [0, 0, 0],
    fov: 60,
  }))
  await waitForFrames(page, 4)
  // Count cyan pixels where the orb’s collision shape projects, 2 m in front of the camera.
  const outline = () => page.evaluate(async () => {
    const {pixels, width, height} = await globalThis.slopGallery!.capturePixels!()
    let cyan = 0
    for (let y = height / 2 - 40; y < height / 2 + 40; y++) {
      for (let x = width / 2 - 40; x < width / 2 + 40; x++) {
        const i = 4 * (y * width + x)
        if (Math.min(pixels[i + 1], pixels[i + 2]) - pixels[i] > 120) {
          cyan++
        }
      }
    }
    return cyan
  })
  const before = await outline()
  await callWebmcpTool(page, 'spawn_orb', {
    orb: 'transparent',
    id: 'prop-orb-probe',
    position: [4, 2, 4],
  })
  await waitForFrames(page, 6)
  const shown = await outline()
  expect(shown - before).toBeGreaterThan(100)
  await callWebmcpTool(page, 'show_colliders', {object: false})
  const hidden = await outline()
  expect(shown - hidden).toBeGreaterThan(100)
  await callWebmcpTool(page, 'show_colliders', {object: 'prop-orb-probe'})
  expect(await outline() - hidden).toBeGreaterThan(100)
  expect(await callWebmcpTool(page, 'clear_layer', {id: 'colliders'})).toEqual({removed: 1})
  expect(await outline()).toBe(hidden)
}, 120_000)
