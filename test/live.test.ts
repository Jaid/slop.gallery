import type {GalleryDiagnostics} from '../src/lib/diagnostics.ts'
import type {Vec3} from '../src/lib/gallery/types.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player'
import fs from 'fs-extra'

import {openHeadlessGallery, resolveGallerySetup, waitForGallery} from '../scripts/lib/headlessGallery.ts'
import {portraitLabelLayout} from '../src/lib/gallery/portraitLabel.ts'
import {wallCoordinates, wallPosition} from '../src/lib/placement/wallGeometry.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

const viewport = {
  width: 1280,
  height: 720,
}
const snapshot = (page: Page) => page.evaluate(() => globalThis.slopGallery!.snapshot!())
/** one part of the page’s snapshot */
const snapshotOf = <Key extends keyof GalleryDiagnostics>(page: Page, key: Key) => page.evaluate(name => globalThis.slopGallery!.snapshot!()[name], key) as Promise<GalleryDiagnostics[Key]>
const portraitOf = (page: Page, match: {
  id?: string
  title?: string
}) => page.evaluate(({id, title}) => globalThis.slopGallery!.snapshot!().portraits.find(portrait => portrait.id === id || portrait.title === title)!, match)
const propOf = (page: Page, id: string) => page.evaluate(prop => globalThis.slopGallery!.snapshot!().props.find(candidate => candidate.id === prop)!, id)
/** the rotation of the player’s view, yaw before pitch, that looks from `from` at `to` */
const lookAt = (from: Vec3, to: Vec3) => {
  const [dx, dy, dz] = to.map((value, axis) => value - from[axis])
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.atan2(dy, Math.hypot(dx, dz))
  return [Math.cos(yaw / 2) * Math.sin(pitch / 2), Math.sin(yaw / 2) * Math.cos(pitch / 2), -Math.sin(yaw / 2) * Math.sin(pitch / 2), Math.cos(yaw / 2) * Math.cos(pitch / 2)]
}
const teleport = (page: Page, eye: Vec3, target: Vec3) => page.evaluate((position, rotation) => globalThis.slopGallery!.teleport!(position, rotation), eye, lookAt(eye, target))
const eyeAt = (position: Vec3): Vec3 => [position[0], slopGallery.floorHeight(position) + defaultEgoOptions.eyeHeight, position[2]]
/** where to stand `distance` meters in front of a wall at its coordinate `u`, looking at height `y` on it */
const facingWall = (wallId: string, u: number, y: number, distance = 2.4) => {
  const wall = slopGallery.walls.find(candidate => candidate.id === wallId)!
  return {
    eye: eyeAt(wallPosition(wall, u, y, distance)),
    target: wallPosition(wall, u, y, 0),
  }
}
const enter = async (page: Page) => {
  await page.click('#enter-gallery')
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().locked && !globalThis.slopGallery!.snapshot!().frozen)
}
/** What the Escape key does, which headless Chrome doesn’t act on: the browser releases the pointer lock while the page keeps the focus, which brings up the pause menu and freezes the world. */
const pause = async (page: Page) => {
  await page.evaluate(() => document.exitPointerLock())
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'pause' && !globalThis.slopGallery!.snapshot!().locked)
}
/** What the Windows key or switching the tab does: the window loses the focus, which releases the pointer lock and brings up the menu over the running world. */
const tabOut = async (page: Page) => {
  await page.evaluate(() => {
    dispatchEvent(new Event('blur'))
    document.exitPointerLock()
  })
  await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().menuStage === 'unfocus' && !globalThis.slopGallery!.snapshot!().locked)
}
const imageFixture = (page: Page) => page.evaluate(async () => {
  const canvas = new OffscreenCanvas(600, 300)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#dc472e'
  context.fillRect(0, 0, 600, 300)
  context.fillStyle = '#244746'
  context.fillRect(100, 50, 300, 200)
  const pngBlob = await canvas.convertToBlob({type: 'image/png'})
  const bytes = new Uint8Array(await pngBlob.arrayBuffer())
  return bytes.toBase64()
})
const paste = (page: Page, image: string, name: string) => page.evaluate((encoded, fileName) => {
  const clipboardData = new DataTransfer
  clipboardData.items.add(new File([Uint8Array.fromBase64(encoded)], `${fileName}.png`, {type: 'image/png'}))
  document.body.dispatchEvent(new ClipboardEvent('paste', {
    clipboardData,
    bubbles: true,
    cancelable: true,
  }))
}, image, name)
const drag = (page: Page, type: string, image: string, name: string, offset = 0) => page.evaluate((eventType, encoded, fileName, horizontalOffset) => {
  const dataTransfer = new DataTransfer
  dataTransfer.items.add(new File([Uint8Array.fromBase64(encoded)], `${fileName}.png`, {type: 'image/png'}))
  const canvas = document.querySelector('canvas')!
  const bounds = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new DragEvent(eventType, {
    dataTransfer,
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + bounds.width / 2 + horizontalOffset,
    clientY: bounds.top + bounds.height / 2,
  }))
}, type, image, name, offset)
/** Teleports round a prop until the view aims at it from about a meter and a half, and resolves with where it stood then. */
const approach = async (page: Page, id: string) => {
  const {position} = await propOf(page, id)
  const center: Vec3 = [position.x, position.y, position.z]
  for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 6) {
    const eye = eyeAt([center[0] + Math.sin(angle) * 1.3, center[1], center[2] + Math.cos(angle) * 1.3])
    await teleport(page, eye, center)
    if (await page.waitForFunction(prop => globalThis.slopGallery!.snapshot!().active === prop, {timeout: 2000}, id).then(() => true, () => false)) {
      return eye
    }
  }
  throw new Error(`Found no place to aim at ${id} from.`)
}
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: visible WebGPU, walking, hanging, imports, fusion, carrying, freezing and new games', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'heavy',
    width: String(viewport.width),
    height: String(viewport.height),
    warmup_scale: 'false',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-live'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await fs.ensureDir('out/live-test')
  try {
    await page.evaluate(() => document.fonts.ready)
    // The loading screen fades out to the menu once the scene is ready.
    await page.waitForFunction(() => !document.querySelector('#loading-screen'))
    const welcome = await snapshot(page)
    expect(welcome.locked).toBe(false)
    expect(await page.$('[data-testid="menu-overlay"]')).not.toBeNull()
    // `?ai=false` hides every AI option, including the OpenRouter key form.
    expect(await page.$('[data-testid="connection"]')).toBeNull()
    await page.screenshot({path: 'out/live-test/production-welcome.png'})
    await page.click('[aria-label="Mute audio"]')
    await enter(page)
    expect(await page.$('[data-testid="menu-overlay"]')).toBeNull()
    // Test the composited browser screenshot, not just a nonblack GPU readback.
    const screenshot = await page.screenshot({path: 'out/live-test/production-gallery.png'})
    const variance = await page.evaluate(async encoded => {
      const screenshotResponse = await fetch(`data:image/png;base64,${encoded}`)
      const bitmap = await createImageBitmap(await screenshotResponse.blob())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(bitmap.width / 4, bitmap.height / 4, bitmap.width / 2, bitmap.height / 2).data
      bitmap.close()
      const values = Array.from({length: pixels.length / 4}, (_, i) => pixels[i * 4])
      const mean = values.reduce((a, b) => a + b) / values.length
      return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    }, screenshot.toBase64())
    expect(variance).toBeGreaterThan(100)
    const rendered = await snapshot(page)
    expect(rendered.webGPU).toBe(true)
    expect(rendered.room).toBe(slopGallery.defaultRoom)
    const baseline = rendered.portraits.length
    expect(baseline).toBeGreaterThan(0)
    // W walks the way the view looks.
    await page.keyboard.down('w')
    await Bun.sleep(350)
    await page.keyboard.up('w')
    const walked = await snapshot(page)
    expect(Math.hypot(walked.camera[0] - rendered.camera[0], walked.camera[2] - rendered.camera[2])).toBeGreaterThan(0.3)
    // The mouse buttons only act on the canvas under the pointer.
    await page.mouse.move(viewport.width / 2, viewport.height / 2)
    // A work hanging where the game starts: its placard names it, the work itself can be picked up and hung elsewhere.
    const work = rendered.portraits.find(portrait => portrait.hung && portrait.wallId && slopGallery.walls.find(wall => wall.id === portrait.wallId)?.room === rendered.room)!
    expect(work).toBeDefined()
    const wall = slopGallery.walls.find(candidate => candidate.id === work.wallId)!
    const u = wallCoordinates(wall, work.position)
    const placard = facingWall(wall.id, u, work.position[1] + portraitLabelLayout(work.width, work.height).y)
    await teleport(page, placard.eye, placard.target)
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().activeLabel === id, {}, work.id)
    expect(await page.$eval('[data-testid="artwork-overlay"]', element => element.textContent)).toContain(work.title)
    const front = facingWall(wall.id, u, work.position[1])
    await teleport(page, front.eye, front.target)
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().active === id && globalThis.slopGallery!.snapshot!().activeLabel === null, {}, work.id)
    expect(await page.$('[data-testid="artwork-overlay"]')).toBeNull()
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === id, {}, work.id)
    // Somewhere else along the wall where there is room for it
    let shift = 0
    let elsewhere = front
    for (const candidate of [0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2]) {
      elsewhere = facingWall(wall.id, u + candidate, work.position[1])
      await teleport(page, elsewhere.eye, elsewhere.target)
      if (await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid, {timeout: 1500}).then(() => true, () => false)) {
        shift = candidate
        break
      }
    }
    expect(shift).not.toBe(0)
    await page.mouse.up({button: 'left'})
    const moved = await portraitOf(page, {id: work.id})
    expect(moved.hung).toBe(true)
    expect(Math.abs(wallCoordinates(wall, moved.position) - u)).toBeGreaterThan(0.3)
    // A spot just above the floor is no place for it; letting go there leaves it where it hangs.
    await teleport(page, elsewhere.eye, wallPosition(wall, u + shift, moved.position[1], 0))
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().active === id, {}, work.id)
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === id, {}, work.id)
    await teleport(page, elsewhere.eye, wallPosition(wall, u + shift, slopGallery.floorHeight(elsewhere.eye) + 0.2, 0))
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid === false)
    await page.mouse.up({button: 'left'})
    const {position: kept} = await portraitOf(page, {id: work.id})
    expect(kept).toEqual(moved.position)
    // The right button throws what is held, which takes it off the wall.
    await teleport(page, elsewhere.eye, wallPosition(wall, u + shift, moved.position[1], 0))
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().active === id, {}, work.id)
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === id, {}, work.id)
    // Down onto the floor behind the player, where it hits no other work, which would fuse with it.
    await teleport(page, elsewhere.eye, wallPosition(wall, u + shift, slopGallery.floorHeight(elsewhere.eye), 4.5))
    await page.mouse.down({button: 'right'})
    await page.mouse.up({button: 'right'})
    await page.mouse.up({button: 'left'})
    await page.waitForFunction(id => !globalThis.slopGallery!.snapshot!().portraits.find(portrait => portrait.id === id)!.hung, {}, work.id)
    // A file dropped onto the spot the work left hangs there, at the spot the drop itself aims at rather than the last preview’s.
    const image = await imageFixture(page)
    await teleport(page, front.eye, front.target)
    await drag(page, 'dragenter', image, 'dropped fixture')
    await page.waitForSelector('[data-testid="drop-overlay"]')
    await drag(page, 'dragover', image, 'dropped fixture')
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().placement?.valid)
    await drag(page, 'drop', image, 'dropped fixture', -10)
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().portraits.some(portrait => portrait.title === 'dropped fixture' && !portrait.pending))
    const dropped = await portraitOf(page, {title: 'dropped fixture'})
    expect(dropped.hung).toBe(true)
    expect(dropped.wallId).toBe(wall.id)
    // The menu of a lost focus leaves the world running, so the fusion below plays out behind it.
    await tabOut(page)
    expect(await snapshotOf(page, 'frozen')).toBe(false)
    await paste(page, image, 'pasted fixture')
    await page.waitForFunction(count => globalThis.slopGallery!.snapshot!().portraits.length === count + 2, {}, baseline)
    const pasted = await portraitOf(page, {title: 'pasted fixture'})
    expect(pasted.width / pasted.height).toBeCloseTo(2, 2)
    expect(pasted.hung).toBe(false)
    const fusing = await page.evaluate((first, second) => {
      globalThis.slopGallery!.fuse!(first, second)
      return globalThis.slopGallery!.snapshot!()
    }, dropped.id, pasted.id)
    expect(fusing.portraits.find(portrait => portrait.id === dropped.id)?.fusing).toBe(true)
    // Without AI, the fusion lays out a collage of its own, which flips out of the portal as the hung work, using up the other one.
    await page.waitForFunction((first, second) => {
      const {portraits} = globalThis.slopGallery!.snapshot!()
      return !portraits.some(portrait => portrait.id === second) && portraits.some(portrait => portrait.id === first && portrait.title === 'An unexpected collaboration' && !portrait.fusing && !portrait.hung)
    }, {timeout: 60_000}, dropped.id, pasted.id)
    expect(await snapshotOf(page, 'portraits')).toHaveLength(baseline + 1)
    // Only the seed survives a reload, so the imports are gone and every work is back where it began, while the visit continues the same game.
    await page.reload({waitUntil: 'domcontentloaded'})
    await waitForGallery(page)
    const reloaded = await snapshot(page)
    expect(reloaded.menuStage).toBe('return')
    expect(reloaded.portraits.map(portrait => [portrait.id, portrait.position])).toEqual(rendered.portraits.map(portrait => [portrait.id, portrait.position]))
    // A reloaded page waits for its rooms again before the physics runs.
    await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
    // Carried props leave the physics: neither the player nor anything else moves them, until they are let go of, thrown or not.
    await page.waitForFunction(() => globalThis.slopGallery!.snapshot!().props.some(candidate => candidate.id.startsWith('prop-orb-')), {timeout: 120_000})
    const props = await snapshotOf(page, 'props')
    const prop = props.find(candidate => candidate.id.startsWith('prop-orb-'))!
    await enter(page)
    await approach(page, prop.id)
    const propState = () => propOf(page, prop.id)
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === id, {}, prop.id)
    const carried = await propState()
    expect(carried.collidersEnabled.length).toBeGreaterThan(0)
    expect(carried.collidersEnabled.every(enabled => !enabled)).toBe(true)
    await page.mouse.up({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === null && globalThis.slopGallery!.snapshot!().props.find(candidate => candidate.id === id)!.collidersEnabled.every(Boolean), {}, prop.id)
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().props.find(candidate => candidate.id === id)!.sleeping, {timeout: 30_000}, prop.id)
    const thrower = await approach(page, prop.id)
    await page.mouse.down({button: 'left'})
    await page.waitForFunction(id => globalThis.slopGallery!.snapshot!().held === id, {}, prop.id)
    // Level across the room, so it is still flying when the world freezes.
    const {room: roomId} = await snapshot(page)
    const room = slopGallery.rooms.find(candidate => candidate.id === roomId)!
    await teleport(page, thrower, [room.center[0], thrower[1], room.center[1]])
    await Bun.sleep(200)
    const {visualPosition: beforeThrow} = await propState()
    await page.keyboard.press('q')
    await page.mouse.up({button: 'left'})
    // The pause menu of the Escape key freezes the world: the thrown prop hangs in the air until the player resumes.
    await Bun.sleep(120)
    await pause(page)
    const hanging = await propState()
    expect(await snapshotOf(page, 'frozen')).toBe(true)
    expect(hanging.sleeping).toBe(false)
    await Bun.sleep(700)
    const stillHanging = await propState()
    expect(stillHanging.position).toEqual(hanging.position)
    expect(stillHanging.visualPosition).toEqual(hanging.visualPosition)
    await enter(page)
    expect(await snapshotOf(page, 'frozen')).toBe(false)
    await Bun.sleep(400)
    const thrown = await propState()
    expect(thrown.collidersEnabled.every(Boolean)).toBe(true)
    expect(Math.hypot(...thrown.visualPosition.map((value, axis) => value - beforeThrow[axis]))).toBeGreaterThan(0.2)
    expect(Math.hypot(thrown.position.x - hanging.position.x, thrown.position.y - hanging.position.y, thrown.position.z - hanging.position.z)).toBeGreaterThan(0.1)
    await pause(page)
    // The graphics switch takes effect at once, and both captures of a frame keep its size and show the scene.
    const graphicsLabel = await page.$eval('[aria-label="Heavy graphics"] small', element => element.textContent)
    await page.click('[aria-label="Heavy graphics"]')
    await page.waitForFunction(before => document.querySelector('[aria-label="Heavy graphics"] small')?.textContent !== before, {}, graphicsLabel)
    await page.screenshot({path: 'out/live-test/production-fast.png'})
    const captures = await page.evaluate(async () => {
      const [a, b] = await Promise.all([globalThis.slopGallery!.captureFrame!(), globalThis.slopGallery!.captureFrame!()])
      return [a.width, b.width, a.nonBlackFraction]
    })
    expect(captures[0]).toBe(viewport.width)
    expect(captures[1]).toBe(viewport.width)
    expect(captures[2]).toBeGreaterThan(0.9)
    // The pause menu fits a narrow window without scrolling sideways.
    await page.setViewport({
      width: 760,
      height: 900,
    })
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth)
    await page.screenshot({path: 'out/live-test/production-narrow.png'})
    // Reroll seed starts a new game with the first menu.
    await page.reload({waitUntil: 'domcontentloaded'})
    await waitForGallery(page)
    await page.waitForSelector('xpath/.//button[normalize-space(.)="Reroll seed"]')
    await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), page.click('xpath/.//button[normalize-space(.)="Reroll seed"]')])
    await waitForGallery(page)
    expect(await snapshotOf(page, 'menuStage')).toBe('first')
    // Every file the page loaded came from its own server.
    const origins = await page.evaluate(() => [...new Set(performance.getEntriesByType('resource').map(entry => URL.parse(entry.name)!.origin))])
    expect(origins.filter(origin => origin !== URL.parse(page.url())!.origin && origin !== 'null')).toEqual([])
    // Without WebGPU, the page says so instead of rendering anything.
    const fallback = await page.browser().newPage()
    await fallback.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'gpu', {value: undefined}))
    await fallback.goto(page.url(), {waitUntil: 'domcontentloaded'})
    await fallback.waitForSelector('[data-testid="render-error"]')
    expect(await fallback.$eval('[data-testid="render-error"]', element => element.textContent)).toContain('WebGPU is unavailable')
    expect(await fallback.$$eval('canvas', elements => elements.length)).toBe(0)
    await fallback.close()
    expect(errors).toEqual([])
  } catch (error) {
    await page.screenshot({path: 'out/live-test/live-failure.png'})
    console.log('Browser errors:', errors)
    const {portraits, props, ...state} = await snapshot(page)
    console.log(JSON.stringify(state), JSON.stringify(portraits.filter(portrait => !portrait.hung || portrait.title.includes('fixture'))))
    throw error
  }
}, 600_000)
