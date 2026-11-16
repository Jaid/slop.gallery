import type {Vec3} from '../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {bastionGolfSill} from '../src/lib/gallery/BastionLanding.ts'
import {climbMouthHollow} from '../src/lib/gallery/bastionNetwork.ts'
import {climbMouth} from '../src/lib/gallery/climb.ts'

// Exercise the production-baked walls, React collider wiring and real keyboard motor, not just the geometry builders.
for (const graphics of ['fast', 'heavy', 'cinematic']) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`production Bastion: step over the golf return threshold in ${graphics}`, async () => {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics,
      room: 'bastion',
      audio: 'false',
      width: '800',
      height: '450',
    })
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-bastion-walk'})
    const {page} = gallery
    const errors: Array<string> = []
    page.on('pageerror', error => errors.push(String(error)))
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
    await waitForLoadingItems(page)
    await page.click('#enter-gallery')
    await page.waitForFunction(() => Boolean(document.pointerLockElement))
    const sill = bastionGolfSill
    for (const returning of [false, true]) {
      for (const lane of [-1.2, 0, 1.2]) {
        const start = sill.x + (returning ? 1.8 : -1)
        const finish = sill.x + (returning ? -1 : 1.8)
        const z = sill.z + lane
        const y = climbMouthHollow.floorAt(start, z) ?? climbMouth.floorY
        const eye: Vec3 = [start, y + 1.62, z]
        const yaw = returning ? Math.PI / 2 : -Math.PI / 2
        const rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
        await page.evaluate((position, facing) => globalThis.slopGallery!.teleport!(position, facing), eye, rotation)
        await waitForFrames(page, 30)
        await page.keyboard.down('w')
        try {
          await page.waitForFunction((end, westward) => {
            const position = globalThis.slopGallery!.player?.position
            return position && (westward ? position.x < end : position.x > end)
          }, {timeout: 30_000}, finish, returning)
        } finally {
          await page.keyboard.up('w')
        }
        await waitForFrames(page, 30)
        const player = await page.evaluate(() => globalThis.slopGallery!.player!)
        expect(player.grounded).toBe(true)
        expect(Math.abs(player.position.z - z)).toBeLessThan(0.06)
        const floor = climbMouthHollow.floorAt(player.position.x, player.position.z) ?? climbMouth.floorY
        expect(Math.abs(player.position.y - floor)).toBeLessThan(0.06)
      }
    }
    expect(errors).toEqual([])
  }, 180_000)
}
