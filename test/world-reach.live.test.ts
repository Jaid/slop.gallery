import type {OutputList} from '../src/lib/vite/outputListPlugin.ts'
import type {WorldAnalysis} from '../src/lib/webmcp/analyzeWorld.ts'
import type {GalleryRoomId} from '../src/worlds/gallery/index.ts'
import type {WorldReachMode} from '../src/worlds/reach.ts'

import {expect, test} from 'bun:test'

import {callWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {curios} from '../src/lib/gallery/curios/index.ts'
import gallery from '../src/worlds/gallery/index.ts'
import relations from '../src/worlds/gallery/relations.ts'

// Run against a production build: this verifies what actually downloads, mounts and registers, not merely what the admission policy says.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('world reach isolates room scenes and their registries in production', async () => {
  const {chunks} = await Bun.file('out/build/production.json').json() as OutputList
  const scenes = new Map(gallery.rooms.map(room => [room.id, chunks.find(chunk => chunk.facadeModule === `src/rooms/${room.id}/scene.tsx`)!.fileName]))
  const cases: ReadonlyArray<{
    mode: WorldReachMode
    room: GalleryRoomId
  }> = [
    ...gallery.rooms.map(room => ({
      room: room.id,
      mode: 'room',
    } as const)),
    {
      room: 'moonfall',
      mode: 'neighbors',
    },
    {
      room: 'lodge',
      mode: 'neighbors',
    },
    {
      room: 'lobby',
      mode: 'all',
    },
  ]
  for (const {room, mode} of cases) {
    const expected = mode === 'all' ? gallery.rooms.map(entry => entry.id) : [room, ...mode === 'neighbors' ? relations[room].rooms : []]
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      graphics: 'fast',
      seed: '1',
      room,
      world_reach: mode,
      width: '640',
      height: '360',
    })
    const started = performance.now()
    await using running = await openHeadlessGallery(setup, {
      cacheDir: 'node_modules/.vite-world-reach',
      initScripts: [() => performance.setResourceTimingBufferSize(4096)],
    })
    const {page} = running
    const errors: Array<string> = []
    page.on('pageerror', error => errors.push(String(error)))
    await waitForLoadingItems(page)
    await waitForFrames(page, 30)
    await page.waitForFunction(() => globalThis.slopGallery?.player?.grounded, {timeout: 15_000})
    const player = await page.evaluate(() => globalThis.slopGallery!.player!)
    const [x, y, z] = gallery.room(room).spawn.position
    expect(Math.hypot(player.position.x - x, player.position.z - z)).toBeLessThan(0.06)
    expect(Math.abs(player.position.y - y)).toBeLessThan(0.06)
    const snapshot = await page.evaluate(() => globalThis.slopGallery!.snapshot!())
    expect(snapshot.worldReach).toEqual({
      mode,
      anchor: room,
      rooms: expected,
    })
    expect(snapshot.loadingItems).toEqual([])
    const requested = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => URL.parse(entry.name)!.pathname.slice(1)))
    for (const [id, file] of scenes) {
      expect(requested.includes(file), `${room}/${mode} fetched ${id}`).toBe(expected.includes(id))
    }
    const curioIds = new Set(curios.map(curio => curio.propId))
    expect(snapshot.props.filter(prop => curioIds.has(prop.id)).map(prop => prop.id).toSorted()).toEqual(curios.filter(curio => expected.includes(curio.room)).map(curio => curio.propId).toSorted())
    const analysis = await callWebmcpTool(page, 'analyze_world') as WorldAnalysis
    const regions = [...Object.values(analysis.rooms), analysis.elsewhere]
    const lights = regions.flatMap(region => region.lights).map(light => light.path).filter(path => path.startsWith('lamps/')).toSorted()
    expect(lights).toEqual(gallery.rooms.filter(entry => expected.includes(entry.id)).flatMap(entry => entry.lamps()).map(lamp => `lamps/${lamp.id}`).toSorted())
    const meshes = regions.flatMap(region => region.meshes)
    for (const id of scenes.keys()) {
      expect(meshes.some(mesh => mesh.path.includes(`/wall-${id}-`)), `${room}/${mode} mounted ${id} walls`).toBe(expected.includes(id))
    }
    for (const portrait of snapshot.portraits) {
      const owner = gallery.walls.find(wall => wall.id === portrait.wallId)?.room
      expect(Boolean(portrait.physical), `${portrait.id} in ${owner}`).toBe(expected.includes(owner!))
    }
    // No late streaming after changing rooms, even outside the admitted set.
    if (mode === 'room' && room === 'moonfall') {
      await page.evaluate(position => globalThis.slopGallery!.pose!({position}), gallery.room('lobby').spawn.position)
      await waitForFrames(page, 30)
      await waitForLoadingItems(page)
      expect(await page.evaluate(() => globalThis.slopGallery!.snapshot!().worldReach.rooms)).toEqual(['moonfall'])
      const later = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => URL.parse(entry.name)!.pathname.slice(1)))
      expect(later.includes(scenes.get('lobby')!)).toBe(false)
    }
    expect(errors).toEqual([])
    console.log(`${room}/${mode}: ${Math.round(performance.now() - started)} ms, ${meshes.length} static meshes, ${lights.length} lamps, ${snapshot.registered} portraits`)
  }
}, 900_000)
test.skipIf(Bun.env.LIVE_TEST !== 'true')('a low flying camera bookmark anchors reach in its room, not the Lobby', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    graphics: 'fast',
    seed: '1',
    spawn: 'antechamber-overview',
    development: 'true',
    world_reach: 'room',
    width: '640',
    height: '360',
  })
  await using running = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-world-reach'})
  await waitForLoadingItems(running.page)
  const snapshot = await running.page.evaluate(() => globalThis.slopGallery!.snapshot!())
  expect(snapshot.worldReach).toEqual({
    anchor: 'antechamber',
    mode: 'room',
    rooms: ['antechamber'],
  })
  const bookmark = gallery.cameraBookmarks().find(camera => camera.id === 'antechamber-overview')!
  for (let axis = 0; axis < 3; axis++) {
    expect(snapshot.camera[axis]).toBeCloseTo(bookmark.position[axis], 3)
  }
}, 120_000)
