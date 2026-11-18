import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

// Exercise the real output quad and capture bridge, including switching from and back to plain rendering in Fast. The camera faces a stationary papered wall so temporal noise will not look like animated paint.
for (const graphics of ['fast', 'heavy']) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`Atelier paints only the margins in ${graphics} graphics`, async () => {
    const frozen = graphics === 'heavy'
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      room: 'cell',
      graphics,
      // Compare the same sample locations; TRAA’s subpixel jitter also moves the detail in the wallpaper.
      anti_aliasing: 'false',
      development: 'true',
      fade: 'false',
      mood: 'paint',
      ...frozen ? {frozen_time: '2'} : {},
      // Exercise both a landscape and a portrait frame.
      width: frozen ? '640' : '384',
      height: frozen ? '384' : '640',
      warmup_scale: 'false',
    })
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-mood-vignette'})
    const {page} = gallery
    await page.evaluate(() => globalThis.slopGallery!.pose!({
      position: [0, 1.8, 0],
      rotation: [0, Math.PI / 2, 0],
    }))
    await waitForFrames(page, 20)
    const result = await page.evaluate(async () => {
      const capture = globalThis.slopGallery!.capturePixels!
      const settle = async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise(requestAnimationFrame)
        }
      }
      const toggle = async () => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', {
          code: 'KeyN',
          bubbles: true,
        }))
        await settle()
      }
      await toggle()
      const plain = await capture()
      await toggle()
      const first = await capture()
      await new Promise(resolve => setTimeout(resolve, 1100))
      const second = await capture()
      await toggle()
      const last = await capture()
      // Fraction of pixels visibly changed in the middle and in the outer quarter of the short side, respectively.
      const difference = (a: typeof plain, b: typeof plain) => {
        const {width, height} = a
        const margin = Math.min(width, height) / 4
        const counts = [0, 0]
        const changed = [0, 0]
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const region = Number(Math.min(x, width - 1 - x, y, height - 1 - y) < margin)
            counts[region]++
            const i = 4 * (y * width + x)
            if ([0, 1, 2].some(c => Math.abs(a.pixels[i + c] - b.pixels[i + c]) > 12)) {
              changed[region]++
            }
          }
        }
        return {
          center: changed[0] / counts[0],
          edge: changed[1] / counts[1],
        }
      }
      return {
        paint: difference(plain, first),
        animation: difference(first, second),
        suppressed: difference(plain, last),
      }
    })
    expect(result.paint.edge).toBeGreaterThan(0.025)
    expect(result.paint.center).toBeLessThan(0.005)
    expect(result.suppressed.edge).toBeLessThan(0.005)
    expect(result.animation.center).toBeLessThan(0.005)
    if (frozen) {
      expect(result.animation.edge).toBeLessThan(0.005)
    } else {
      expect(result.animation.edge).toBeGreaterThan(0.02)
    }
  }, 180_000)
}
