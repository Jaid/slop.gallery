import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import {alchemySink, cannonLaunch} from '../src/lib/gallery/alchemy/alchemyMachine.ts'

type PropModule = typeof import('../src/components/Scene/GrabbableProp.tsx')

test.skipIf(Bun.env.LIVE_TEST !== 'true')('a hot-updated Forge sees mounted orbs and completes the intake and launch', async () => {
  const setup = await resolveGallerySetup({
    room: 'forge',
    world_reach: 'room',
    seed: '0',
    graphics: 'fast',
    width: '720',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-forge-intake'})
  const path = '/src/components/Scene/GrabbableProp.tsx'
  // Vite evaluates a fresh module URL on update, while already mounted props still belong to the previous module.
  const refreshed = `${path}?t=${Date.now()}`
  const dropped = await gallery.page.evaluate(async (original, updated, [x, y, z]) => {
    const before = await import(original) as PropModule
    const after = await import(updated) as PropModule
    if (before === after || before.propObjects !== after.propObjects) {
      return false
    }
    return after.propObjects.get('prop-orb-transparent-holder-1')?.fling([x, y + 0.3, z], [0, 0, 0])
  }, path, refreshed, alchemySink.center)
  expect(dropped).toBe(true)
  // Reaching the pipe isn’t sufficient: the brewed orb must leave the barrel under physics.
  await gallery.page.waitForFunction(async (moduleUrl, launchZ) => {
    const {propObjects} = await import(moduleUrl) as PropModule
    return propObjects.values().some(prop => prop.orb && prop.body.isEnabled() && prop.body.translation().z < launchZ && prop.body.linvel().z < -5)
  }, {timeout: 30_000}, refreshed, cannonLaunch.position[2])
}, 180_000)
