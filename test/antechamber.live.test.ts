import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {antechamberLanding, stairHalls} from '../src/lib/gallery/antechamber.ts'
import staircase, {stairFloorHeight} from '../src/lib/gallery/staircase.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('production Antechamber: walk from the solar hall up to the landing, back down, through the dome into the lunar hall and down into Moonfall', async () => {
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
  // facing north, so W walks north, S south, A west and D east
  await page.evaluate(([wx, wz]) => globalThis.slopGallery!.teleport!([wx, 1.65, wz], [0, 0, 0, 1]), [x, z])
  await waitForFrames(page, 40)
  const walk = async (key: 'a' | 'd' | 's' | 'w', destination: number) => {
    await page.keyboard.down(key)
    try {
      await page.waitForFunction((input, target) => {
        const p = globalThis.slopGallery!.player?.position
        return p && {
          a: p.x < target,
          d: p.x > target,
          s: p.z > target,
          w: p.z < target,
        }[input]
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
  const landing = await walk('s', antechamberLanding.center[1])
  expect(landing.y).toBeCloseTo(antechamberLanding.floorY + 0.02, 2)
  const solar = await walk('w', z + 0.15)
  expect(solar.y).toBeCloseTo(0.02, 2)
  const lunar = await walk('d', stairHalls.east.center[0])
  expect(lunar.y).toBeCloseTo(0.02, 2)
  const feet = await walk('d', staircase.startX + 3)
  // At a nosing the capsule can still rest on the previous tread, which its trailing edge overlaps.
  expect(feet.y).toBeGreaterThanOrEqual(stairFloorHeight(feet.x, feet.z)! - 0.005)
  expect(feet.y).toBeLessThanOrEqual(stairFloorHeight(feet.x - 0.3, feet.z)! + 0.025)
  expect(await page.evaluate(() => globalThis.slopGallery!.snapshot!().room)).toBe('moonfall')
}, 180_000)
