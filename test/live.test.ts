import type {GalleryDiagnostics as Snapshot} from '../src/lib/diagnostics.ts'
import type {Vec3} from '../src/lib/gallery/types.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import fs from 'fs-extra'
import puppeteer from 'puppeteer-core'
import {preview} from 'vite'

import artworks from '../src/worlds/gallery/artworks.ts'

const baseline = artworks.length
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const teleport = (page: Page, position: Vec3, rotation = [0, 0, 0, 1]) => page.evaluate((cameraPosition, cameraRotation) => globalThis.slopGallery!.teleport!(cameraPosition, cameraRotation), position, rotation)
const enter = async (page: Page) => {
  await page.waitForSelector('#enter-gallery')
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
}
const clickText = async (page: Page, text: string) => {
  const button = await page.waitForSelector(`xpath/.//button[starts-with(normalize-space(.), "${text}")]`)
  await button!.click()
}
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: visible WebGPU, physics, imports, fusion and new games', async () => {
  const server = await preview({
    preview: {
      host: '127.0.0.1',
      port: 5187,
      strictPort: false,
    },
  })
  const browser = await puppeteer.launch({
    executablePath: Bun.env.BROWSER,
    headless: true,
    defaultViewport: {
      width: 1440,
      height: 1000,
    },
    args: ['--enable-unsafe-webgpu'],
  })
  const errors: Array<string> = []
  const external: Array<string> = []
  const page = await browser.newPage()
  const baseUrl = server.resolvedUrls!.local[0]
  try {
    page.on('pageerror', error => errors.push(String(error)))
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
    page.on('request', request => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) {
        external.push(request.url())
      }
    })
    await page.evaluateOnNewDocument(() => {
      let submits = 0
      const NativeQueue = globalThis.GPUQueue as typeof GPUQueue | undefined
      if (NativeQueue) {
        // eslint-disable-next-line typescript/unbound-method -- called on the queue as this
        const {submit} = NativeQueue.prototype
        NativeQueue.prototype.submit = function (commandBuffers) {
          submits++
          return submit.call(this, commandBuffers)
        }
      }
      const contexts: Array<AudioContext> = []
      const NativeAudioContext = globalThis.AudioContext
      globalThis.AudioContext = new Proxy(NativeAudioContext, {
        construct(Target, args: Array<unknown>, newTarget) {
          const instance = Reflect.construct(Target, args, newTarget) as AudioContext
          contexts.push(instance)
          return instance
        },
      })
      Object.assign(globalThis, {
        __liveProbe: {
          submits: () => submits,
          audioStates: () => contexts.map(context => context.state),
        },
      })
    })
    // Wait for scene readiness below; network-idle navigation is not a rendering signal.
    await page.goto(`${baseUrl}?ai=false&test=true&seed=1`, {waitUntil: 'domcontentloaded'})
    await page.waitForFunction(() => globalThis.slopGallery?.snapshot?.().ready, {timeout: 60_000})
    await page.evaluate(() => document.fonts.ready)
    await fs.ensureDir('out/live-test')
    // The loading screen fades out to the menu once the scene is ready.
    await page.waitForFunction(() => !document.querySelector('#loading-screen'))
    const welcomeSnapshot = await snapshot(page)
    expect(welcomeSnapshot.locked).toBe(false)
    expect(await page.$('[data-testid="menu-overlay"]')).not.toBeNull()
    // `?ai=false` hides every AI option, including the OpenRouter key form.
    expect(await page.$('[data-testid="connection"]')).toBeNull()
    await page.screenshot({path: 'out/live-test/production-welcome.png'})
    await page.click('[aria-label="Mute audio"]')
    await enter(page)
    expect(await page.$('[data-testid="menu-overlay"]')).toBeNull()
    expect(await page.$('[data-testid="artwork-overlay"]')).toBeNull()
    const screenshot = await page.screenshot({path: 'out/live-test/production-gallery.png'})
    // Test the composited browser screenshot, not just a nonblack GPU readback.
    const variance = await page.evaluate(async encoded => {
      const screenshotResponse = await fetch(`data:image/png;base64,${encoded}`)
      const bitmap = await createImageBitmap(await screenshotResponse.blob())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const pixels = context.getImageData(655, 395, 125, 125).data
      const values = Array.from({length: pixels.length / 4}, (_, i) => pixels[i * 4])
      const mean = values.reduce((a, b) => a + b) / values.length
      return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    }, screenshot.toBase64())
    expect(variance).toBeGreaterThan(500)
    const renderedSnapshot = await snapshot(page)
    expect(renderedSnapshot.webGPU).toBe(true)
    expect(renderedSnapshot.portraits).toHaveLength(baseline)
    const z = renderedSnapshot.camera[2]
    await page.keyboard.down('w')
    await Bun.sleep(350)
    await page.keyboard.up('w')
    const walkedSnapshot = await snapshot(page)
    expect(walkedSnapshot.camera[2]).toBeLessThan(z - 0.3)
    const {rotation: rotationBeforeLook} = await snapshot(page)
    await page.mouse.move(820, 460)
    await page.waitForFunction(before => JSON.stringify(globalThis.slopGallery!.snapshot!().rotation) !== JSON.stringify(before), {}, rotationBeforeLook)
    const lookingAtPlate = Math.atan2(1.105 - 1.62, 3.28)
    await teleport(page, [-3.6, 1.62, -4.5], [Math.sin(lookingAtPlate / 2), 0, 0, Math.cos(lookingAtPlate / 2)])
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().activeLabel === 'goose')
    expect(await page.$eval('[data-testid="artwork-overlay"]', element => element.textContent)).toContain('His Unbothered Majesty')
    expect(await page.$eval('[data-testid="artwork-overlay"]', element => element.textContent)).toContain('Cornelius van Honk')
    expect(await page.$eval('[data-testid="artwork-overlay"]', element => element.textContent)).toContain('Undated')
    const lookingUp = [Math.sin(0.13), 0, 0, Math.cos(0.13)]
    await teleport(page, [-3.6, 1.62, -4.5], lookingUp)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().active === 'goose')
    const lookingUpSnapshot = await snapshot(page)
    expect(lookingUpSnapshot.activeLabel).toBeNull()
    expect(await page.$('[data-testid="artwork-overlay"]')).toBeNull()
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().held === 'goose')
    await teleport(page, [-6.3, 1.62, -4.5], lookingUp)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid && Math.abs(globalThis.slopGallery!.snapshot!().camera[0] + 6.3) < 0.01)
    await page.mouse.up({button: 'left'})
    const {portraits: portraitsAfterDrop} = await snapshot(page)
    const moved = portraitsAfterDrop.find(p => p.id === 'goose')!.position
    expect(moved[0]).toBeCloseTo(-6.3)
    // A low wall target is invalid; dropping must leave the work where it hangs.
    await teleport(page, [-6.3, 1.62, -4.5], lookingUp)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().active === 'goose')
    await page.mouse.down({button: 'left'})
    await teleport(page, [-6.3, 1.62, -4.5])
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid === false)
    await page.mouse.up({button: 'left'})
    const {portraits: portraitsAfterInvalidDrop} = await snapshot(page)
    expect(portraitsAfterInvalidDrop.find(p => p.id === 'goose')!.position).toEqual(moved)
    await teleport(page, [-6.3, 1.62, -4.5], lookingUp)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().active === 'goose')
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().held === 'goose')
    await page.mouse.down({button: 'right'})
    await page.mouse.up({button: 'right'})
    await page.mouse.up({button: 'left'})
    const {portraits: portraitsAfterUnhang} = await snapshot(page)
    expect(portraitsAfterUnhang.find(p => p.id === 'goose')!.hung).toBe(false)
    await page.evaluate(() => document.exitPointerLock())
    const image = await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(600, 300)
      const context = canvas.getContext('2d')!
      context.fillStyle = '#dc472e'
      context.fillRect(0, 0, 600, 300)
      context.fillStyle = '#244746'
      context.fillRect(100, 50, 300, 200)
      const pngBlob = await canvas.convertToBlob({type: 'image/png'})
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())
      return pngBytes.toBase64()
    })
    await teleport(page, [0, 1.62, 4])
    await page.evaluate(encoded => {
      const clipboardData = new DataTransfer
      clipboardData.items.add(new File([Uint8Array.fromBase64(encoded)], 'import fixture.png', {type: 'image/png'}))
      document.body.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }))
    }, image)
    await page.waitForFunction(baselinePortraitCount => {
      const portraits = globalThis.slopGallery!.snapshot!().portraits
      return portraits.length === baselinePortraitCount + 1 && portraits.some(p => p.title === 'import fixture')
    }, {}, baseline)
    const {portraits: portraitsAfterImport} = await snapshot(page)
    const imported = portraitsAfterImport.find(p => p.title === 'import fixture')!
    expect(imported.width / imported.height).toBe(2)
    expect(imported.hung).toBe(false)
    await enter(page)
    const pending = await page.evaluate(id => {
      globalThis.slopGallery!.fuse!('orange', id)
      return globalThis.slopGallery!.snapshot!()
    }, imported.id)
    expect(pending.portraits.find(p => p.id === 'orange')?.fusing).toBe(true)
    expect(pending.portraits).toHaveLength(baseline + 1)
    await page.waitForFunction(id => {
      const portraits = globalThis.slopGallery!.snapshot!().portraits
      return !portraits.some(p => p.id === id) && portraits.some(p => p.id === 'orange' && p.title === 'An unexpected collaboration' && !p.fusing)
    }, {}, imported.id)
    const {portraits: portraitsAfterFusion} = await snapshot(page)
    expect(portraitsAfterFusion).toHaveLength(baseline)
    // Only the seed survives a reload, so the fusion is gone while the visit continues the same game.
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForFunction(() => globalThis.slopGallery?.snapshot?.().ready)
    const reloaded = await snapshot(page)
    expect(reloaded.portraits.find(p => p.id === 'orange')!.title).toBe('A Slightly Larger Tomorrow')
    expect(reloaded.menuStage).toBe('return')
    await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), clickText(page, 'Reroll seed')])
    await page.waitForFunction(() => globalThis.slopGallery?.snapshot?.().ready)
    const newGame = await snapshot(page)
    expect(newGame.menuStage).toBe('first')
    await enter(page)
    await page.keyboard.press('Escape')
    await page.evaluate(() => document.exitPointerLock())
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'pause')
    await page.waitForFunction(() => {
      const probe = (globalThis as {__liveProbe?: {audioStates: () => Array<string>}}).__liveProbe
      return probe?.audioStates().every(state => state === 'suspended')
    })
    const pauseSubmitsBefore = await page.evaluate(() => (globalThis as unknown as {__liveProbe: {submits: () => number}}).__liveProbe.submits())
    await Bun.sleep(250)
    const pauseSubmitsAfter = await page.evaluate(() => (globalThis as unknown as {__liveProbe: {submits: () => number}}).__liveProbe.submits())
    expect(pauseSubmitsAfter).toBe(pauseSubmitsBefore)
    // Unfocus (Windows key / tabbing out) keeps rendering and audio running.
    await enter(page)
    await page.waitForFunction(() => {
      const probe = (globalThis as {__liveProbe?: {audioStates: () => Array<string>}}).__liveProbe
      return probe?.audioStates().includes('running')
    })
    await page.evaluate(() => {
      globalThis.dispatchEvent(new Event('blur'))
      document.exitPointerLock()
    })
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'unfocus')
    const unfocusSubmitsBefore = await page.evaluate(() => (globalThis as unknown as {__liveProbe: {submits: () => number}}).__liveProbe.submits())
    await Bun.sleep(250)
    const unfocusSubmitsAfter = await page.evaluate(() => (globalThis as unknown as {__liveProbe: {submits: () => number}}).__liveProbe.submits())
    expect(unfocusSubmitsAfter).toBeGreaterThan(unfocusSubmitsBefore)
    expect(await page.evaluate(() => (globalThis as unknown as {__liveProbe: {audioStates: () => Array<string>}}).__liveProbe.audioStates())).toContain('running')
    await enter(page)
    await page.keyboard.press('Escape')
    await page.evaluate(() => document.exitPointerLock())
    await teleport(page, [-6.3, 1.62, -4.5], lookingUp)
    await page.waitForFunction(() => Math.abs(globalThis.slopGallery!.snapshot!().camera[0] + 6.3) < 0.01)
    const drag = (type: string, offset = 0) => page.evaluate((eventType, encoded, horizontalOffset) => {
      const file = new File([Uint8Array.fromBase64(encoded)], 'dropped fixture.png', {type: 'image/png'})
      const dataTransfer = new DataTransfer
      dataTransfer.items.add(file)
      const canvas = document.querySelector('canvas')!
      const bounds = canvas.getBoundingClientRect()
      canvas.dispatchEvent(new DragEvent(eventType, {
        dataTransfer,
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2 + horizontalOffset,
        clientY: bounds.top + bounds.height / 2,
      }))
    }, type, image, offset)
    await drag('dragenter')
    await page.waitForSelector('[data-testid="drop-overlay"]')
    await drag('dragover')
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid)
    // Deliberately change the final drop coordinate without another preview frame.
    await drag('drop', -10)
    await page.waitForFunction(baselinePortraitCount => {
      const portraits = globalThis.slopGallery!.snapshot!().portraits
      return portraits.length === baselinePortraitCount + 1 && portraits.some(p => p.title === 'dropped fixture')
    }, {}, baseline)
    const {portraits: portraitsAfterFileDrop} = await snapshot(page)
    const dropped = portraitsAfterFileDrop.find(p => p.title === 'dropped fixture')!
    expect(dropped.hung).toBe(true)
    expect(dropped.position[0]).toBeLessThan(-6.32)
    await page.evaluate(encoded => {
      const clipboardData = new DataTransfer
      clipboardData.items.add(new File([Uint8Array.fromBase64(encoded)], 'pasted fixture.png', {type: 'image/png'}))
      document.body.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }))
    }, image)
    await page.waitForFunction(baselinePortraitCount => {
      const portraits = globalThis.slopGallery!.snapshot!().portraits
      return portraits.length === baselinePortraitCount + 2 && portraits.some(p => p.title === 'pasted fixture')
    }, {}, baseline)
    const {portraits: portraitsAfterPaste} = await snapshot(page)
    expect(portraitsAfterPaste.some(p => p.title === 'pasted fixture')).toBe(true)
    await enter(page)
    for (const [x, room] of [[-14, 'vesper'], [14, 'banquet']] as const) {
      await teleport(page, [x, 1.62, 3])
      await page.waitForFunction(expectedRoom => globalThis.slopGallery!.snapshot!().room === expectedRoom, {}, room)
      await page.screenshot({path: `out/live-test/production-${room}.png`})
    }
    await page.evaluate(() => document.exitPointerLock())
    // Walk through both boolean-cut portals from both sides, including near a jamb.
    for (const side of [-1, 1]) {
      for (const returning of [false, true]) {
        const x = side * (returning ? 9.4 : 6.6)
        const yaw = side * (returning ? Math.PI / 2 : -Math.PI / 2)
        await teleport(page, [x, 1.62, 3.7], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
        await page.waitForSelector('#enter-gallery')
        await enter(page)
        await page.waitForFunction(() => !!document.pointerLockElement)
        await page.keyboard.down('w')
        await page.waitForFunction(({side: portalSide, returning: isReturning}) => {
          const cameraX = globalThis.slopGallery!.snapshot!().camera[0]
          return isReturning ? Math.abs(cameraX) < 7.4 : cameraX * portalSide > 8.6
        }, {timeout: 8000}, {
          side,
          returning,
        })
        await page.keyboard.up('w')
        const {camera: cameraAfterPortal} = await snapshot(page)
        expect(cameraAfterPortal[1]).toBeCloseTo(1.62, 1)
        await page.evaluate(() => document.exitPointerLock())
      }
    }
    // Carried sculptures must never become moving platforms for the character controller.
    await teleport(page, [-12.25, 1.62, -39.4], [Math.sin(0.12), 0, 0, Math.cos(0.12)])
    await enter(page)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().active === 'prop-knot-astra1')
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().held === 'prop-knot-astra1')
    for (const [position, rotation] of [
      [[19.45, 1.62, 3], [0, -Math.SQRT1_2, 0, Math.SQRT1_2]],
      [[16, 1.62, 3], [-Math.sin(0.65), 0, 0, Math.cos(0.65)]],
      [[18, 1.62, 7.45], [0, 1, 0, 0]],
    ] satisfies Array<[Vec3, Array<number>]>) {
      await teleport(page, position, rotation)
      await Bun.sleep(1000)
      const state = await snapshot(page)
      expect(Math.hypot(...state.camera.map((value, axis) => value - position[axis]))).toBeLessThan(0.05)
      const knot = state.props.find(prop => prop.id === 'prop-knot-astra1')!
      expect(knot.bodyType).toBe(1)
      expect(knot.collidersEnabled.length).toBeGreaterThan(0)
      expect(knot.collidersEnabled.every(enabled => !enabled)).toBe(true)
    }
    await page.mouse.up({button: 'left'})
    await Bun.sleep(500)
    const released = await snapshot(page)
    expect(Math.hypot(...released.camera.map((value, axis) => value - [18, 1.62, 7.45][axis]))).toBeLessThan(0.05)
    expect(released.props.find(prop => prop.id === 'prop-knot-astra1')!.bodyType).toBe(0)
    expect(released.props.find(prop => prop.id === 'prop-knot-astra1')!.collidersEnabled.every(Boolean)).toBe(true)
    expect(released.props.find(prop => prop.id === 'prop-knot-astra1')!.position.z).toBeLessThan(7)
    await teleport(page, [-12.25, 1.62, -39.4], [Math.sin(0.12), 0, 0, Math.cos(0.12)])
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().active === 'prop-knot-astra1')
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().held === 'prop-knot-astra1')
    const {props: propsBeforeThrow} = await snapshot(page)
    const beforeThrow = propsBeforeThrow.find(prop => prop.id === 'prop-knot-astra1')!.position
    await page.keyboard.press('q')
    await page.mouse.up({button: 'left'})
    await Bun.sleep(400)
    const {props: propsAfterThrow} = await snapshot(page)
    const thrown = propsAfterThrow.find(prop => prop.id === 'prop-knot-astra1')!
    expect(thrown.bodyType).toBe(0)
    expect(thrown.collidersEnabled.every(Boolean)).toBe(true)
    expect(Math.hypot(thrown.position.x - beforeThrow.x, thrown.position.y - beforeThrow.y, thrown.position.z - beforeThrow.z)).toBeGreaterThan(0.2)
    await page.evaluate(() => document.exitPointerLock())
    // The rear room is accessible from the lobby.
    await teleport(page, [0, 1.62, 6], [0, 1, 0, 0])
    await enter(page)
    await page.keyboard.down('w')
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().room === 'antechamber')
    await page.keyboard.up('w')
    await page.evaluate(() => document.exitPointerLock())
    await page.screenshot({path: 'out/live-test/production-good-taste.png'})
    const graphicsLabel = await page.$eval('[aria-label="Heavy graphics"] small', element => element.textContent)
    await page.click('[aria-label="Heavy graphics"]')
    await page.waitForFunction(before => document.querySelector('[aria-label="Heavy graphics"] small')?.textContent !== before, {}, graphicsLabel)
    await page.screenshot({path: 'out/live-test/production-heavy.png'})
    const captures = await page.evaluate(async () => {
      const [a, b] = await Promise.all([globalThis.slopGallery!.captureFrame!(), globalThis.slopGallery!.captureFrame!()])
      return [a.width, b.width, a.nonBlackFraction]
    })
    expect(captures[0]).toBe(1440)
    expect(captures[1]).toBe(1440)
    expect(captures[2]).toBeGreaterThan(0.9)
    await page.setViewport({
      width: 760,
      height: 900,
    })
    const muted = await page.$eval('[aria-label="Mute audio"]', button => button.getAttribute('aria-pressed'))
    await enter(page)
    await page.waitForFunction(() => !!document.pointerLockElement)
    await page.keyboard.press('Tab')
    await page.waitForSelector('dialog[open]')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
    await page.keyboard.press('m')
    await page.screenshot({path: 'out/live-test/production-narrow.png'})
    await page.keyboard.press('Escape')
    expect(await page.$eval('[aria-label="Mute audio"]', button => button.getAttribute('aria-pressed'))).toBe(muted)
    const fallback = await browser.newPage()
    await fallback.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'gpu', {value: undefined}))
    await fallback.goto(`${baseUrl}?ai=false`, {waitUntil: 'domcontentloaded'})
    await fallback.waitForSelector('[data-testid="render-error"]')
    expect(await fallback.$eval('[data-testid="render-error"]', element => element.textContent)).toContain('WebGPU is unavailable')
    expect(await fallback.$$eval('canvas', elements => elements.length)).toBe(0)
    await fallback.close()
    expect(external).toEqual([])
    expect(errors).toEqual([])
  } catch (error) {
    await page.screenshot({path: 'out/live-test/live-failure.png'})
    console.log('Browser errors:', errors)
    console.log(await snapshot(page), await page.$eval('body', b => b.innerText))
    throw error
  } finally {
    await browser.close()
    await new Promise<void>((resolve, reject) => server.httpServer.close(error => (error ? reject(error) : resolve())))
  }
}, 180_000)
