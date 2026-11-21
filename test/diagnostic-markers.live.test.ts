import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('the Lobby diagnostics mark its middle chandelier, fountain emitter and both unspawned sights on independent layers', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    seed: '0',
    graphics: 'fast',
    room: 'lobby',
    world_reach: 'room',
    fountain: 'marble',
    show_lamps: 'true',
    show_ambience_emitters: 'true',
    show_sloperator_sightings: 'true',
    line_width: '400',
    width: '800',
    height: '600',
    paused: 'true',
    frozen_time: '2',
    warmup_scale: 'false',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-diagnostic-markers'})
  const {page} = gallery
  const lookNorth = async (y: number) => {
    await page.evaluate(eyeY => globalThis.slopGallery!.fly!({
      position: [0, eyeY, -10],
      rotation: [0, 0, 0],
      fov: 90,
    }), y)
    await waitForFrames(page, 6)
  }
  const sample = () => page.evaluate(async () => {
    const {pixels, width, height} = await globalThis.slopGallery!.capturePixels!()
    const center = 4 * (height / 2 * width + width / 2)
    // Two meters away the dot radius is 18 px, its outer rim 26 px.
    const rim = center + 4 * 22
    let lime = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 1] - Math.max(pixels[i], pixels[i + 2]) > 150) {
        lime++
      }
    }
    return {
      red: pixels[center],
      green: pixels[center + 1],
      rim: pixels[rim] + pixels[rim + 1] + pixels[rim + 2],
      lime,
    }
  })
  const clear = (id: string) => callWebmcpTool(page, 'clear_layer', {id})
  await lookNorth(6.6)
  const lamp = await sample()
  expect(Math.min(lamp.red, lamp.green)).toBeGreaterThan(220)
  expect(await clear('lamps')).toEqual({removed: 1})
  const withoutLamp = await sample()
  expect(withoutLamp.rim).toBeGreaterThan(lamp.rim + 50)
  await lookNorth(3.02)
  const emitter = await sample()
  expect(emitter.red - emitter.green).toBeGreaterThan(160)
  expect(await clear('ambience-emitters')).toEqual({removed: 1})
  const withoutEmitter = await sample()
  expect(withoutEmitter.rim).toBeGreaterThan(emitter.rim + 50)
  await lookNorth(1)
  const sights = await callWebmcpTool(page, 'dump_sloperator', {}) as Array<{state: string}>
  expect(sights.map(sight => sight.state)).toEqual(['away', 'away'])
  const boxes = await sample()
  expect(await clear('sloperator-sightings')).toEqual({removed: sights.length})
  const withoutBoxes = await sample()
  expect(boxes.lime - withoutBoxes.lime).toBeGreaterThan(100)
}, 180_000)
