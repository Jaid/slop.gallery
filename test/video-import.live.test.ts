import {expect, test} from 'bun:test'
import {join} from 'node:path'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, serveFile} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('drops, pastes, file selections and video URLs each contribute one still of the first frame', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    graphics: 'fast',
    seed: '0',
    room: 'studio',
    portraits: '0',
    paused: 'true',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-video-import'})
  const {page} = gallery
  // A 96 × 32 VP9 clip. Only the middle 64 px of frame zero are red; the rest, including the entire second frame, is blue.
  const file = join(import.meta.dir, 'fixtures', 'first-frame.webm')
  const bytes = await Bun.file(file).bytes()
  const clip = bytes.toBase64()
  const picker = (await page.waitForSelector('input[data-artwork-input]'))!
  expect(await picker.evaluate(input => input.accept.split(','))).toContain('video/*')
  for (const [index, via] of (['drop', 'paste'] as const).entries()) {
    await picker.evaluate((input, method, encoded) => {
      const files = new DataTransfer
      if (method === 'drop') {
        // A corrupt file must not block the next one, even when it has neither a MIME type nor an extension.
        files.items.add(new File(['not a video'], 'broken.webm', {type: 'video/webm'}))
      }
      files.items.add(new File([Uint8Array.fromBase64(encoded)], method === 'drop' ? 'untagged' : 'clip.webm', {type: method === 'drop' ? '' : 'video/webm'}))
      if (method === 'paste') {
        input.parentElement!.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: files,
          bubbles: true,
          cancelable: true,
        }))
      } else {
        input.parentElement!.dispatchEvent(new DragEvent('drop', {
          dataTransfer: files,
          bubbles: true,
          cancelable: true,
        }))
      }
    }, via, clip)
    await page.waitForFunction(count => document.querySelectorAll('[data-portrait] img').length >= count, {}, index + 1)
  }
  await picker.uploadFile(file)
  await page.waitForFunction(() => document.querySelectorAll('[data-portrait] img').length >= 3)
  await using served = serveFile(file)
  for (const [id, image] of [['from-data', `data:application/octet-stream;base64,${clip}`], ['from-http', `${served.url}#t=0.04`]]) {
    await callWebmcpTool(page, 'add_portrait', {
      image,
      target: {position: {
        x: 3,
        y: 2,
        z: 4,
      }},
      id,
    })
    await page.waitForSelector(`[data-portrait="${id}"] img`)
  }
  const portraits = await page.$$eval('[data-portrait] img', images => Promise.all(images.map(async image => {
    await image.decode()
    const {naturalWidth: width, naturalHeight: height} = image
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const {data} = context.getImageData(0, height / 2, width, 1)
    // Identify the swatch across the whole crop, allowing for chroma subsampling and the thumbnail’s WebP encoding.
    const red = data.every((value, i) => (i % 4 === 0 || i % 4 === 3 ? value > 192 : value < 64))
    return {
      width,
      height,
      red,
    }
  })))
  expect(portraits).toHaveLength(5)
  for (const portrait of portraits) {
    expect(portrait).toEqual({
      width: 64,
      height: 32,
      red: true,
    })
  }
}, 180_000)
