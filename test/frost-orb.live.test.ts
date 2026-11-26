import type {PortraitDump} from '../src/lib/webmcp/dumpPortraits.ts'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'

/** A plain horizon makes it possible to tell snow following the picture’s contours from a tint or a screen overlay. */
test.skipIf(Bun.env.LIVE_TEST !== 'true')('throwing a Frost Orb with AI off prints snow onto the work itself', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    room: 'studio',
    seed: '0',
    graphics: 'fast',
    portraits: '0',
    width: '720',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-frost'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.waitForSelector('#enter-gallery:not([disabled])')
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#cba779'
    ctx.fillRect(0, 0, 320, 120)
    ctx.fillStyle = '#18202a'
    ctx.fillRect(0, 120, 320, 120)
    return canvas.toDataURL()
  })
  await callWebmcpTool(page, 'add_portrait', {
    image,
    target: {slot: 'studio-north'},
    id: 'horizon',
    title: 'Horizon',
  })
  await page.evaluate(() => globalThis.slopGallery!.fly!({
    position: [4, 2, 5],
    rotation: [0, 0, 0],
  }))
  const from = [4, 1.8, 2.3]
  const prop = 'prop-orb-frost'
  await callWebmcpTool(page, 'spawn_orb', {
    orb: 'frost',
    id: prop,
    position: from,
  })
  await callWebmcpTool(page, 'throw_prop', {
    prop,
    from,
    portrait: 'horizon',
  })
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().portraits.some(p => p.id === 'horizon' && !p.hung && !p.fusing && !p.title), {timeout: 60_000})
  const [result] = await callWebmcpTool(page, 'dump_portraits') as Array<PortraitDump>
  expect(result.frame).toBe('acrylic')
  expect(result.width / result.height).toBeCloseTo(4 / 3, 6)
  await page.waitForFunction(id => {
    const {props} = globalThis.slopGallery!.snapshot!()
    return !props.some(p => p.id === id) && props.some(p => p.id.startsWith(`${id}-remains-`))
  }, {}, prop)
  // Inspect the collection’s decoded thumbnail, which has no mood, portal or frame drawn over it.
  await page.evaluate(() => document.exitPointerLock())
  const thumb = await page.waitForSelector('[data-portrait="horizon"] img')
  const sample = await thumb!.evaluate(async img => {
    await img.decode()
    const canvas = new OffscreenCanvas(320, 240)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, 320, 240)
    const row = (y: number) => ctx.getImageData(80, y, 160, 1).data.filter((_, i) => i % 4 === 1).reduce((a, b) => a + b, 0) / 160
    return {
      sky: row(90),
      rim: row(120),
      ground: row(180),
    }
  })
  expect(sample.sky - sample.ground).toBeGreaterThan(60)
  expect(sample.rim - sample.ground).toBeGreaterThan(45)
  expect(errors).toEqual([])
}, 180_000)
