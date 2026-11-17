import type {OutputList} from '../src/lib/vite/outputListPlugin.ts'
import type {WorldAnalysis} from '../src/lib/webmcp/analyzeWorld.ts'
import type {GalleryRoomId} from '../src/worlds/gallery/index.ts'

import {expect, test} from 'bun:test'

import {callWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {curios} from '../src/lib/gallery/curios/index.ts'
import {outputListFile} from '../src/lib/vite/outputListPlugin.ts'
import slopGallery from '../src/worlds/gallery/index.ts'
import relations from '../src/worlds/gallery/relations.ts'

const sorted = (ids: Iterable<string>) => [...ids].toSorted()
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production world reach: room boundaries, registries, physics and downloads stay inside the startup scope', async () => {
  const {chunks} = await Bun.file(outputListFile).json() as OutputList
  const roomChunks = new Map(slopGallery.rooms.map(({id}) => [id, chunks.find(chunk => chunk.facadeModule === `src/rooms/${id}/components/${id[0].toUpperCase() + id.slice(1)}Room/index.tsx`)!.fileName]))
  const cases: Array<{
    mode?: 'all' | 'neighbors' | 'room'
    room: GalleryRoomId
    spawn?: string
  }> = [
    ...slopGallery.rooms.map(room => ({
      room: room.id,
      mode: 'room',
    } as const)),
    {
      room: 'lodge',
      mode: 'neighbors',
    },
    {
      room: 'moonfall',
      mode: 'neighbors',
    },
    {
      room: 'sienna',
      mode: 'neighbors',
    },
    {
      room: 'lodge',
      mode: 'room',
      spawn: 'lodge-overview',
    },
    {
      room: 'lobby',
      mode: 'all',
    },
    {room: 'lobby'},
  ]
  for (const {room, mode, spawn} of cases) {
    const allowed = mode === undefined || mode === 'all' ? slopGallery.rooms.map(value => value.id) : [room, ...mode === 'neighbors' ? relations[room].rooms : []]
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics: Bun.env.LIVE_GRAPHICS ?? 'fast',
      room,
      spawn,
      world_reach: mode,
      show_ambience_emitters: 'true',
      width: '800',
      height: '450',
    })
    const start = performance.now()
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-world-reach'})
    const {page} = gallery
    await page.waitForFunction(ids => globalThis.slopGallery!.snapshot!().mountedRooms.length === ids.length, {timeout: 120_000}, allowed)
    await waitForLoadingItems(page)
    await waitForFrames(page, 45)
    const snapshot = await page.evaluate(() => globalThis.slopGallery!.snapshot!())
    expect(snapshot.worldReach).toEqual({
      mode: mode ?? 'all',
      room,
      rooms: allowed,
    })
    expect(sorted(snapshot.mountedRooms)).toEqual(sorted(allowed))
    expect(snapshot.registered).toBeGreaterThanOrEqual(0)
    const hung = snapshot.portraits.filter(portrait => portrait.hung && allowed.includes(slopGallery.placement.wall(portrait.wallId!)!.room as GalleryRoomId))
    expect(sorted(snapshot.portraits.filter(portrait => portrait.physical).map(portrait => portrait.id))).toEqual(sorted(hung.map(portrait => portrait.id)))
    for (const curio of curios) {
      expect(snapshot.props.some(prop => prop.id === curio.propId)).toBe(allowed.includes(curio.room))
    }
    // Every world lamp exists from the first frame, but none from an excluded room does.
    const analysis = await callWebmcpTool(page, 'analyze_world') as WorldAnalysis
    const regions = [analysis.elsewhere, ...Object.values(analysis.rooms)]
    const lights = regions.flatMap(region => region.lights).filter(light => light.path.startsWith('lamps/')).map(light => light.path.slice('lamps/'.length))
    const wantedLamps = slopGallery.rooms.filter(value => allowed.includes(value.id)).flatMap(value => value.lamps()).map(lamp => lamp.id)
    expect(sorted(lights)).toEqual(sorted(wantedLamps))
    const paths = regions.flatMap(region => region.meshes.map(mesh => mesh.path))
    const emitters = paths.filter(path => path.endsWith('/ambience-emitter')).map(path => path.split('/').at(-2)!)
    const wantedEmitters = slopGallery.rooms.filter(value => allowed.includes(value.id)).flatMap(value => value.ambiences()).map(sound => sound.id)
    expect(sorted(emitters)).toEqual(sorted(wantedEmitters))
    for (const wall of slopGallery.walls) {
      expect(paths.some(path => path.endsWith(`/wall-${wall.id}`))).toBe(allowed.includes(wall.room as GalleryRoomId))
    }
    expect(paths.some(path => path.includes('moonfall-stairway'))).toBe(allowed.includes('moonfall'))
    // No Enter click is needed: physics runs behind the intro menu as soon as the reached floors exist.
    if (!spawn) {
      const player = await page.evaluate(() => globalThis.slopGallery!.player!)
      expect(player.grounded).toBe(true)
      const [x, y, z] = slopGallery.room(room).spawn.position
      expect(Math.hypot(player.position.x - x, player.position.z - z)).toBeLessThan(0.06)
      expect(Math.abs(player.position.y - y)).toBeLessThan(0.06)
    }
    // Check actual downloads, not just hidden meshes. A changed camera must never fetch the excluded rooms later.
    const outside = slopGallery.rooms.find(value => !allowed.includes(value.id))
    if (outside) {
      await page.evaluate(position => globalThis.slopGallery!.pose!({position}), outside.spawn.position)
      await waitForFrames(page, 20)
    }
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => {
      const url = new URL(entry.name)
      return url.pathname.slice(1)
    }))
    for (const [id, file] of roomChunks) {
      expect(resources.includes(file)).toBe(allowed.includes(id))
    }
    expect(sorted(await page.evaluate(() => globalThis.slopGallery!.snapshot!().mountedRooms))).toEqual(sorted(allowed))
    console.log(`${mode ?? 'default'}/${spawn ?? room}: ${allowed.length} rooms, ${lights.length} lamps, ${snapshot.registered} portraits, ${Math.round(performance.now() - start)} ms`)
  }
}, 1_200_000)
