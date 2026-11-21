import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('layer priority wins over submission order and clearing reveals the layer beneath', async () => {
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
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-overlay-layers'})
  const {page} = gallery
  await page.evaluate(() => globalThis.slopGallery!.fly!({
    position: [0, 2, 5],
    rotation: [0, 0, 0],
    fov: 90,
  }))
  await waitForFrames(page, 8)
  // Count saturated green and magenta near screen center, where the two world-space segments coincide.
  const sample = () => page.evaluate(async () => {
    const {pixels, width, height} = await globalThis.slopGallery!.capturePixels!()
    let green = 0
    let magenta = 0
    for (let y = Math.floor(height * 0.45); y < height * 0.55; y++) {
      for (let x = Math.floor(width * 0.4); x < width * 0.6; x++) {
        const i = 4 * (y * width + x)
        if (pixels[i + 1] - Math.max(pixels[i], pixels[i + 2]) > 128) {
          green++
        }
        if (Math.min(pixels[i], pixels[i + 2]) - pixels[i + 1] > 128) {
          magenta++
        }
      }
    }
    return {
      green,
      magenta,
    }
  })
  // Submit the highest-priority visible layer first; give the last, yellow layer a cutoff short of the line.
  for (const options of [{
    id: 'top',
    color: '#00ff00',
    priority: 1,
    fade: false,
    lineStyle: 'aliased',
    lineWidth: 400,
  }, {
    id: 'base',
    color: '#ff00ff',
  }, {
    id: 'culled',
    color: '#ffff00',
    priority: 2,
    fade: {
      start: 0,
      end: 1,
    },
  }]) {
    await callWebmcpTool(page, 'add_layer', {
      lineWidth: 800,
      ...options,
    })
    await callWebmcpTool(page, 'add_drawing', {drawing: {
      layer: options.id,
      type: 'line',
      from: [-3, 2, 1],
      to: [3, 2, 1],
    }})
  }
  const top = await sample()
  expect(top.green).toBeGreaterThan(100)
  expect(top.magenta).toBeGreaterThan(100) // the wider layer peeks out on either side
  expect(await callWebmcpTool(page, 'clear_layer', {id: 'top'})).toEqual({removed: 1})
  const base = await sample()
  expect(base.magenta).toBeGreaterThan(100)
  expect(base.green).toBeLessThan(10)
  expect(await callWebmcpTool(page, 'clear_drawings', {})).toEqual({removed: 2})
  const cleared = await sample()
  expect(cleared.magenta).toBeLessThan(10)
}, 180_000)
