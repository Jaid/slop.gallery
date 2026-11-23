import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {eastStair, stairHalls} from '../src/lib/gallery/antechamber.ts'
import {stairFloorHeight} from '../src/lib/gallery/staircase.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('production Antechamber: walk from the west hall to the upper landing, then down into Moonfall', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    room: 'antechamber',
    world_reach: 'neighbors',
    seed: '0',
    graphics: 'fast',
    width: '800',
    height: '450',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-antechamber-walk'})
  const {page} = gallery
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
  const [x, z] = stairHalls.west.center
  await page.evaluate(([wx, wz]) => globalThis.slopGallery!.teleport!([wx, 1.65, wz], [0, 0, 0, 1]), [x, z])
  await waitForFrames(page, 40)
  const walk = async (key: 'a' | 'd' | 's', destination: number) => {
    await page.keyboard.down(key)
    try {
      await page.waitForFunction((input, target) => {
        const p = globalThis.slopGallery!.player?.position
        return p && (input === 'a' ? p.x < target : (input === 'd' ? p.x > target : p.z > target))
      }, {timeout: 40_000}, key, destination)
    } finally {
      await page.keyboard.up(key)
    }
    await waitForFrames(page, 25)
    const player = await page.evaluate(() => globalThis.slopGallery!.player!)
    expect(player.grounded).toBe(true)
    return player.position
  }
  expect(await page.evaluate(() => globalThis.slopGallery!.player!.position.y)).toBeCloseTo(0.02, 2)
  const upper = await walk('d', eastStair.start[0] - 0.8)
  expect(upper.y).toBeCloseTo(eastStair.start[1] + 0.02, 2)
  const west = await walk('a', x + 0.15)
  expect(west.y).toBeCloseTo(0.02, 2)
  const landing = await walk('s', stairHalls.return.center[1] + 0.25)
  expect(landing.y).toBeCloseTo(0.02, 2)
  const feet = await walk('d', 0)
  // At a nosing the capsule can still rest on the previous tread, which its trailing edge overlaps.
  expect(feet.y).toBeGreaterThanOrEqual(stairFloorHeight(feet.x, feet.z)! - 0.005)
  expect(feet.y).toBeLessThanOrEqual(stairFloorHeight(feet.x - 0.3, feet.z)! + 0.025)
  expect(await page.evaluate(() => globalThis.slopGallery!.snapshot!().room)).toBe('moonfall')
}, 180_000)
