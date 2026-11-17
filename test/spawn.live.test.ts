import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

// Every room brings its floors with it once it streams in, so the physics waits for them. Starting the production build in each room, the player has to stand at the room’s spawn once it runs.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: the player keeps standing after spawning in any room', async () => {
  const misplaced: Array<string> = []
  for (const room of slopGallery.rooms) {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics: 'heavy',
      room: room.id,
      width: '800',
      height: '450',
    })
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-spawn'})
    const {page} = gallery
    // The world asks for the other rooms on the frames after the loading screen, and the physics runs once none of them is loading anymore.
    await waitForFrames(page, 5)
    await page.waitForFunction(() => !globalThis.slopGallery!.snapshot!().loadingItems.some(item => item.startsWith('room:')), {timeout: 120_000})
    await waitForFrames(page, 90)
    const player = await page.evaluate(() => globalThis.slopGallery!.player)
    const [x, y, z] = room.spawn.position
    if (!player?.grounded || Math.abs(player.position.y - y) > 0.06 || Math.hypot(player.position.x - x, player.position.z - z) > 0.06) {
      misplaced.push(`${room.id}: expected to stand at ${[x, y, z].join(', ')}, ${player ? `found ${player.grounded ? 'standing' : 'airborne'} at ${[player.position.x, player.position.y, player.position.z].map(value => value.toFixed(2)).join(', ')}` : 'but the physics never ran'}`)
    }
  }
  expect(misplaced).toEqual([])
}, 600_000)
