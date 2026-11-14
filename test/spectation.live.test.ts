import type {GalleryDiagnostics as Snapshot} from '../src/lib/diagnostics.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

type FrameCounts = {
  /** frames drawn on the studio view’s canvas since the last count */
  studio: number
  /** frames drawn on any other canvas, like the world’s */
  world: number
}

const collection = '[data-testid="portrait-collection"]'
const spectation = '[data-testid="portrait-spectation"]'
const viewer = '[data-testid="portrait-viewer"]'
const stage = `${viewer} [role="application"]`
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const enter = async (page: Page) => {
  await page.waitForSelector('#enter-gallery:not([disabled])')
  await page.click('#enter-gallery')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
}
/** What the Escape key does, which headless Chrome doesn’t act on: the browser releases the pointer lock while the page keeps the focus, which brings up the pause menu and freezes the world. */
const pause = async (page: Page) => {
  await page.evaluate(() => document.exitPointerLock())
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'pause' && !globalThis.slopGallery!.snapshot!().locked && globalThis.slopGallery!.snapshot!().frozen)
  await page.waitForSelector(`${collection} [data-portrait]`)
}
/** Stands 2.6 m in front of the hung work, looking at it, whichever way its wall faces, and tells whether the player aims at it now. */
const face = async (page: Page, id: string) => {
  const {portraits} = await snapshot(page)
  const [x, y, z] = portraits.find(portrait => portrait.id === id)!.position
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await page.evaluate((position, rotation) => globalThis.slopGallery!.teleport!(position, rotation), [x + Math.sin(yaw) * 2.6, y, z + Math.cos(yaw) * 2.6] as [number, number, number], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
    const aimed = await page.waitForFunction(target => globalThis.slopGallery!.snapshot!().active === target, {timeout: 1500}, id).then(() => true, () => false)
    if (aimed) {
      return true
    }
  }
  return false
}
/** Clicks the work in the collection and waits until its model stands on the stage. */
const spectate = async (page: Page, id: string) => {
  await page.click(`${collection} [data-portrait="${id}"]`)
  await page.waitForSelector(`${spectation}[data-portrait="${id}"] ${viewer}[data-progress="ready"]`, {timeout: 60_000})
}
const isOpen = async (page: Page) => await page.$(spectation) !== null
/** The id of the work the page says its menu shows up close. */
const spectating = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!().spectating)
const isFrozen = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!().frozen)
const textOf = (page: Page, selector: string) => page.$eval(selector, element => (element as HTMLElement).innerText)
/** Counts the frames every WebGPU canvas of the page presents from now on. */
const countFrames = (page: Page) => page.evaluate(() => {
  const counts = new Map<HTMLCanvasElement | OffscreenCanvas, number>
  // eslint-disable-next-line typescript/unbound-method -- called with the context as this
  const original = GPUCanvasContext.prototype.getCurrentTexture
  GPUCanvasContext.prototype.getCurrentTexture = function (this: GPUCanvasContext) {
    counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1)
    return original.call(this)
  }
  Object.assign(globalThis, {
    takeFrameCounts: () => {
      const studioCanvas = document.querySelector('[data-testid="portrait-viewer"] canvas')
      const taken = {
        studio: 0,
        world: 0,
      }
      for (const [canvas, count] of counts) {
        taken[canvas === studioCanvas ? 'studio' : 'world'] += count
      }
      counts.clear()
      return taken
    },
  })
})
const takeFrameCounts = (page: Page): Promise<FrameCounts> => page.evaluate(() => (globalThis as unknown as {takeFrameCounts: () => FrameCounts}).takeFrameCounts())
/** How much the stage’s picture varies, as the composited page shows it: the variance of the red channel over its middle. */
const stageVariance = async (page: Page) => {
  const box = await page.$eval(stage, element => {
    const {x, y, width, height} = element.getBoundingClientRect()
    return {
      x: x + width / 4,
      y: y + height / 4,
      width: width / 2,
      height: height / 2,
    }
  })
  const shot = await page.screenshot({clip: box})
  return page.evaluate(async encoded => {
    const response = await fetch(`data:image/png;base64,${encoded}`)
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const {data} = context.getImageData(0, 0, canvas.width, canvas.height)
    const values = Array.from({length: data.length / 4}, (_, index) => data[index * 4])
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  }, shot.toBase64())
}
// The pause menu’s view of a work up close, in the production build with its real studio: what it tells of a work the player met and of one they haven’t, that its model shows and turns without waking the frozen world, and every way to put it away.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: a work of the collection up close in the pause menu', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    width: '1280',
    height: '720',
    warmup_scale: 'false',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-spectation'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.waitForFunction(() => !document.querySelector('#loading-screen'))
  await enter(page)
  const {portraits} = await snapshot(page)
  // Listen to the first hung work the player can stand in front of; another one stays untouched.
  let known: Snapshot['portraits'][number] | undefined
  for (const portrait of portraits) {
    if (portrait.hung && await face(page, portrait.id)) {
      known = portrait
      break
    }
  }
  expect(known).toBeDefined()
  // The world takes the key in with its next frames, which the pause would hold back.
  await page.keyboard.down('e')
  await waitForFrames(page, 10)
  await page.keyboard.up('e')
  await waitForFrames(page, 10)
  const untouched = portraits.find(portrait => portrait.hung && portrait.id !== known!.id)!
  await pause(page)
  await page.waitForSelector(`${collection} [data-portrait="${known!.id}"][data-interacted="true"]`)
  expect(await isOpen(page)).toBe(false)
  expect(await spectating(page)).toBeNull()
  expect(await page.$('[data-testid="minimap"]')).not.toBeNull()
  await countFrames(page)
  // A work the player hasn’t interacted with yet: a faint model, and nothing told but its room.
  await spectate(page, untouched.id)
  expect(await spectating(page)).toBe(untouched.id)
  expect(await page.$('[data-testid="minimap"]')).toBeNull()
  expect(await page.$('#enter-gallery')).toBeNull()
  expect(await page.$eval(spectation, element => element.getAttribute('data-interacted'))).toBe('false')
  const secret = await textOf(page, spectation)
  expect(secret).toContain('Untouched work')
  expect(secret).not.toContain(untouched.title)
  expect(await textOf(page, '[data-testid="portrait-room"]')).not.toBe('')
  expect(await page.$eval(`${collection} [data-portrait="${untouched.id}"]`, element => element.getAttribute('aria-pressed'))).toBe('true')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="portrait-viewer"] canvas')!).opacity === '0.25')
  // A work the player listened to: everything the gallery tells about it, at full strength.
  await spectate(page, known!.id)
  const told = await textOf(page, spectation)
  expect(told).toContain(known!.title)
  expect(told).toMatch(/creator/iu)
  expect(told).toMatch(/year/iu)
  expect(await textOf(page, '[data-testid="portrait-room"]')).not.toBe('')
  expect(await page.$eval(stage, element => element.getAttribute('aria-label'))).toContain(known!.title)
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="portrait-viewer"] canvas')!).opacity === '1')
  // Its canvas is as large as its stage, in device pixels, and shows a picture.
  const fit = await page.$eval(`${viewer} canvas`, element => {
    const canvas = element
    const {width, height} = canvas.getBoundingClientRect()
    return [canvas.width - Math.round(width), canvas.height - Math.round(height)]
  })
  expect(Math.abs(fit[0])).toBeLessThanOrEqual(1)
  expect(Math.abs(fit[1])).toBeLessThanOrEqual(1)
  expect(await stageVariance(page)).toBeGreaterThan(200)
  // At rest, nothing draws: neither the studio nor the frozen world behind the menu.
  await Bun.sleep(700)
  await takeFrameCounts(page)
  await Bun.sleep(1000)
  expect(await takeFrameCounts(page)).toEqual({
    studio: 0,
    world: 0,
  })
  // Dragging turns the model, which draws the studio alone and comes to rest again.
  const {x, y} = await page.$eval(stage, element => {
    const box = element.getBoundingClientRect()
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }
  })
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 80, y + 20, {steps: 8})
  await page.mouse.up()
  await Bun.sleep(1500)
  const turning = await takeFrameCounts(page)
  expect(turning.studio).toBeGreaterThan(10)
  expect(turning.world).toBe(0)
  await Bun.sleep(700)
  expect(await takeFrameCounts(page)).toEqual({
    studio: 0,
    world: 0,
  })
  expect(await isFrozen(page)).toBe(true)
  // The work’s own menu still opens beside the view, and the Escape key closes only the menu first.
  await page.click(`${collection} [data-portrait="${known!.id}"]`, {button: 'right'})
  await page.waitForSelector('[role="menu"]:popover-open')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="menu"]:popover-open'))
  expect(await isOpen(page)).toBe(true)
  // Then the view, which brings the map back and hands the focus to the work it came from.
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-testid="minimap"]')
  expect(await isOpen(page)).toBe(false)
  expect(await spectating(page)).toBeNull()
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-portrait'))).toBe(known!.id)
  // A click on the work shown puts the view away too, as does its close button.
  await spectate(page, known!.id)
  await page.click(`${collection} [data-portrait="${known!.id}"]`)
  await page.waitForSelector('[data-testid="minimap"]')
  expect(await isOpen(page)).toBe(false)
  await spectate(page, known!.id)
  await page.click('[aria-label="Back to the map"]')
  await page.waitForSelector('[data-testid="minimap"]')
  expect(await isOpen(page)).toBe(false)
  // The menu is whole again, so the player can go on, which the world follows as the browser reports the pointer locked.
  await enter(page)
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().locked && !globalThis.slopGallery!.snapshot!().frozen)
  expect(errors).toEqual([])
}, 180_000)
