import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('a sphere stays round from the front and off-axis from the side, and shrinks with distance', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    seed: '0',
    graphics: 'fast',
    room: 'lobby',
    world_reach: 'room',
    width: '960',
    height: '540',
    warmup_scale: 'false',
    frozen_time: '2',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-overlay-sphere'})
  const {page} = gallery
  await callWebmcpTool(page, 'add_layer', {
    id: 'bounds',
    color: '#00ff00',
    lineWidth: 600,
  })
  await callWebmcpTool(page, 'add_drawing', {drawing: {
    type: 'sphere',
    layer: 'bounds',
    center: [0, 2, 0],
    radius: 0.5,
  }})
  for (const pose of [[0, 5, 0, 5], [5, 3, Math.PI / 2, 5], [10, 3, Math.PI / 2, 10]]) {
    await page.evaluate(([x, z, yaw]) => globalThis.slopGallery!.fly!({
      position: [x, 2, z],
      rotation: [0, yaw, 0],
      fov: 90,
    }), pose)
    await waitForFrames(page, 4)
    const bounds = await page.evaluate(async () => {
      const {pixels, width, height} = await globalThis.slopGallery!.capturePixels!()
      let left = width
      let right = -1
      let top = height
      let bottom = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (!(pixels[i + 1] - Math.max(pixels[i], pixels[i + 2]) > 160)) {
            continue
          }
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      }
      return {
        w: right - left + 1,
        h: bottom - top + 1,
        height,
      }
    })
    expect(Math.abs(bounds.w - bounds.h)).toBeLessThanOrEqual(2)
    // At 90° vertical FOV the one-meter diameter spans half the viewport height divided by depth, plus the stroke.
    expect(Math.abs(bounds.h - bounds.height / (2 * pose[3]))).toBeLessThan(5)
  }
}, 180_000)
