import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('a viewport rectangle stays put while a world rectangle faces the moving camera and shrinks in perspective', async () => {
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
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-overlay-rectangles'})
  const {page} = gallery
  await callWebmcpTool(page, 'add_layer', {
    id: 'hud',
    color: '#ff00ff',
    lineWidth: 800,
    fade: {
      start: 0,
      end: 1,
    },
    obstructedOpacityFactor: 0,
  })
  await callWebmcpTool(page, 'add_drawing', {drawing: {
    type: 'viewport_rectangle',
    layer: 'hud',
    x: 0.1,
    y: 0.2,
    width: 0.2,
    height: 0.1,
  }})
  await callWebmcpTool(page, 'add_layer', {
    id: 'world-bounds',
    color: '#00ff00',
    lineWidth: 800,
  })
  await callWebmcpTool(page, 'add_drawing', {drawing: {
    type: 'camera_facing_rectangle',
    layer: 'world-bounds',
    center: [0, 2, 0],
    width: 2,
    height: 1,
  }})
  for (const pose of [[0, 5, 0, 5], [10, 2, Math.PI / 2, 10]]) {
    await page.evaluate(([x, z, yaw]) => globalThis.slopGallery!.fly!({
      position: [x, 2, z],
      rotation: [0, yaw, 0],
      fov: 90,
    }), pose)
    await waitForFrames(page, 4)
    const captured = await page.evaluate(async () => {
      const {width, height, pixels} = await globalThis.slopGallery!.capturePixels!()
      const hud = [width, height, -1, -1]
      const world = [...hud]
      for (let y = 0;y < height;y++) {
        for (let x = 0;x < width;x++) {
          const i = 4 * (y * width + x)
          const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
          const box = g - Math.max(r, b) > 190 ? world : (Math.min(r, b) - g > 190 ? hud : undefined)
          if (!box) {
            continue
          }
          box[0] = Math.min(box[0], x)
          box[1] = Math.min(box[1], y)
          box[2] = Math.max(box[2], x)
          box[3] = Math.max(box[3], y)
        }
      }
      return {
        width,
        height,
        hud,
        world,
      }
    })
    const depth = pose[3]
    const expected = [0.1 * captured.width, 0.2 * captured.height, 0.3 * captured.width, 0.3 * captured.height]
    for (const [i, value] of expected.entries()) {
      expect(Math.abs(captured.hud[i] - value)).toBeLessThan(4)
    }
    expect(Math.abs(captured.world[2] - captured.world[0] - captured.height / depth)).toBeLessThan(5)
    expect(Math.abs(captured.world[3] - captured.world[1] - captured.height / (2 * depth))).toBeLessThan(5)
  }
  expect(await callWebmcpTool(page, 'clear_drawings', {})).toEqual({removed: 2})
}, 180_000)
