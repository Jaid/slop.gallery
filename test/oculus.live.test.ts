import type {Vec3} from '../src/lib/gallery/types.ts'
import type {KeyInput} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {frameToWorld, tunnelFrame} from '../src/lib/gallery/exhibitionTunnel.ts'
import lowerGallery from '../src/lib/gallery/lowerGallery.ts'

const {tunnel} = lowerGallery
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
  // Moonfall → Oculus → Moonfall through the tunnel, its straight runs out of both rooms and its diagonal between them, crossing both junctions of its sloped slabs with the level ones. Each run starts facing along it.
  const {elbow, length, yaw} = tunnelFrame
  const facing = (angle: number) => [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]
  const eyes = 1.6 + 0.02
  const [highX, highZ] = frameToWorld([0, length - elbow])
  const [lowX, lowZ] = frameToWorld([0, elbow])
  await teleport([tunnel.south[0], tunnel.southY + eyes, tunnel.south[1] + 1])
  await walk('w', 'z', highZ + 0.3, false, tunnel.southY + 0.02)
  await teleport([highX, tunnel.southY + eyes, highZ], facing(yaw))
  await walk('w', 'z', lowZ, false, tunnel.northY + 0.02)
  await teleport([tunnel.north[0], tunnel.northY + eyes, lowZ])
  await walk('w', 'z', tunnel.north[1] - 0.5, false, tunnel.northY + 0.02)
  await teleport([tunnel.north[0], tunnel.northY + eyes, tunnel.north[1] - 0.5], facing(Math.PI))
  await walk('w', 'z', lowZ - 0.3, true, tunnel.northY + 0.02)
  await teleport([lowX, tunnel.northY + eyes, lowZ], facing(yaw + Math.PI))
  await walk('w', 'z', highZ, true, tunnel.southY + 0.02)
  await teleport([tunnel.south[0], tunnel.southY + eyes, highZ], facing(Math.PI))
  await walk('w', 'z', tunnel.south[1] + 1, true, tunnel.southY + 0.02)
  // Climb the east switchback, including the flat lateral turn, then descend the west one.
  await teleport([5.7, -9.38, -29])
  await walk('s', 'z', -19.95, true, -7.98)
  await walk('d', 'x', 7.8, true, -7.98)
  await walk('w', 'z', -30.6, false, -4.98)
  await teleport([-7.9, -3.38, -30.8])
  await walk('s', 'z', -19.95, true, -7.98)
  await walk('d', 'x', -5.8, true, -7.98)
  await walk('w', 'z', -28.9, false, -10.98)
  expect(errors).toEqual([])
}, 180_000)
