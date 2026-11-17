import type {Vec3} from '../src/lib/gallery/types.ts'
import type {KeyInput} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import lowerGallery, {oculusApproach, oculusLowerRamps, oculusPlatform, oculusRampLandings, oculusRamps, tunnelDiagonalYaw} from '../src/lib/gallery/lowerGallery.ts'

// Separate from the collection/import smoke test: exercise the actual baked meshes, React collider wiring and keyboard motor.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production Oculus: inclined connection and two-flight switchbacks', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '1',
    graphics: 'fast',
    anti_aliasing: 'false',
    width: '800',
    height: '450',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-oculus-walk'})
  const {page} = gallery
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.click('#enter-gallery')
  await page.waitForFunction(() => !!document.pointerLockElement)
  const teleport = async (position: Vec3, rotation = [0, 0, 0, 1]) => {
    await page.evaluate((p, r) => globalThis.slopGallery!.teleport!(p, r), position, rotation)
    await waitForFrames(page, 30)
  }
  const walk = async (key: KeyInput, axis: 'x' | 'z', target: number, greater: boolean, expectedY: number) => {
    await page.keyboard.down(key)
    try {
      await page.waitForFunction((dimension, destination, increasing) => {
        const position = globalThis.slopGallery!.player?.position
        return position && (increasing ? position[dimension] > destination : position[dimension] < destination)
      }, {timeout: 40_000}, axis, target, greater)
    } finally {
      await page.keyboard.up(key)
    }
    await waitForFrames(page, 35)
    const player = await page.evaluate(() => globalThis.slopGallery!.player!)
    expect(player.grounded).toBe(true)
    expect(Math.abs(player.position.y - expectedY)).toBeLessThan(0.06)
  }
  /** Turns the view in place to `yaw`, 0 facing north. */
  const face = async (yaw: number) => {
    const [x, y, z] = await page.evaluate(() => globalThis.slopGallery!.snapshot!().camera)
    await teleport([x, y, z], [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
  }
  // Moonfall → Oculus → Moonfall through the beveled tunnel, crossing both sloped slab/portal junctions.
  const {tunnel} = lowerGallery
  const [moonfallFeet, oculusFeet] = [tunnel.southY + 0.02, tunnel.northY + 0.02]
  await teleport([tunnel.southX, tunnel.southY + 1.62, tunnel.southZ + 1])
  await walk('w', 'z', tunnel.southBendZ - 0.5, false, moonfallFeet)
  // The view’s yaw of the diagonal, which runs from the south bend north-east, is the tunnel’s.
  await face(tunnelDiagonalYaw)
  await walk('w', 'z', tunnel.northBendZ + 0.5, false, oculusFeet)
  await face(0)
  await walk('w', 'z', tunnel.northZ - 0.5, false, oculusFeet)
  await face(Math.PI)
  await walk('w', 'z', tunnel.northBendZ + 0.5, true, oculusFeet)
  await face(tunnelDiagonalYaw + Math.PI)
  await walk('w', 'z', tunnel.southBendZ - 0.5, true, moonfallFeet)
  await face(Math.PI)
  await walk('w', 'z', tunnel.southZ + 1, true, moonfallFeet)
  // Cross the level approach to the east switchback, climb to the platform and descend the west one.
  const platformFeet = oculusPlatform.position[1] + oculusPlatform.size[1] / 2 + 0.02
  const approachFeet = oculusFeet + oculusApproach.rise
  const crossingZ = (oculusApproach.northZ + oculusApproach.southZ) / 2
  const turnZ = oculusRampLandings[0].position[2]
  await teleport([oculusApproach.x, approachFeet + 1.6, crossingZ])
  await walk('d', 'x', oculusLowerRamps[1].x - 0.1, true, approachFeet)
  await walk('s', 'z', turnZ, true, moonfallFeet)
  await walk('d', 'x', oculusRamps[1].x - 0.1, true, moonfallFeet)
  await walk('w', 'z', oculusApproach.northZ - 0.2, false, platformFeet)
  await teleport([oculusRamps[0].x, platformFeet + 1.6, oculusApproach.northZ - 0.2])
  await walk('s', 'z', turnZ, true, moonfallFeet)
  await walk('d', 'x', oculusLowerRamps[0].x - 0.1, true, moonfallFeet)
  await walk('w', 'z', crossingZ, false, approachFeet)
  expect(errors).toEqual([])
}, 180_000)
