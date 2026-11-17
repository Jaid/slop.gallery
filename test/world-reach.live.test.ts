import type {GalleryDiagnostics as Snapshot} from '../src/lib/diagnostics.ts'
import type {WorldAnalysis} from '../src/lib/webmcp/analyzeWorld.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import slopGallery from '../src/worlds/gallery/index.ts'
import relations, {openings} from '../src/worlds/gallery/relations.ts'

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => globalThis.slopGallery!.snapshot!())
const lampIds = new Set(slopGallery.lamps().map(lamp => lamp.id))
/** the ids of the world’s lamps among the analysis’ positioned lights, whose paths end in their light’s name, the lamp’s global id */
const analyzedLamps = (analysis: WorldAnalysis) => [...Object.values(analysis.rooms).flatMap(room => room.lights), ...analysis.elsewhere.lights].map(light => light.path.split('/').at(-1)).filter((id): id is string => id !== undefined && lampIds.has(id)).toSorted()
const lampsOf = (rooms: ReadonlyArray<string>) => slopGallery.lamps().filter(lamp => rooms.includes(lamp.room)).map(lamp => lamp.id).toSorted()
/** the ids of the walls an opening into one of the rooms passes through, which stay built to seal it against the void */
const boundaryWalls = (rooms: ReadonlyArray<string>) => new Set(openings.filter(opening => opening.rooms.some(room => rooms.includes(room))).flatMap(opening => opening.holes.map(([wallId]) => wallId)))
/**
 * The meshes of a region that belong to no reached room: neither a part of one of its sealing walls nor a mesh of a reached room’s own building whose bounds spill into the region, like the Bastion’s cistern window reveal reaching into the Forge.
 * Paths name what built a mesh, like `world/bastion-room/…` or a wall’s id, which the region it was sorted into says nothing about.
 */
/** the names of what fills the openings between two rooms, which either side within reach keeps: the apse grilles, the Lobby’s cast glass, the Lodge’s windows and threshold and the Moonfall stairway */
const boundaryFixtures = ['oculus-apse-grilles', 'oculus-apse-bars', 'oculus-apse-reveals', 'salon-window', 'forge-window', 'lodge-tunnel-window', 'lodge-east-window', 'lodge-threshold', 'moonfall-stairway']
const foreignMeshes = (region: WorldAnalysis['rooms'][string], rooms: ReadonlyArray<string>) => {
  const boundary = boundaryWalls(rooms)
  return region.meshes.filter(mesh => !boundary.has(mesh.path.split('/')[0]) && !mesh.path.split('/').some(segment => boundaryFixtures.includes(segment) || rooms.some(room => segment === room || segment.startsWith(`${room}-`)))).map(mesh => mesh.path)
}
/** Waits until the physics runs and the player stands grounded at the room’s spawn, as in the spawn test. */
const expectStanding = async (page: Page, room: string) => {
  const [x, y, z] = slopGallery.room(room as never).spawn.position
  await page.waitForFunction(() => globalThis.slopGallery!.player?.grounded === true, {timeout: 120_000})
  await waitForFrames(page, 10)
  const player = await page.evaluate(() => globalThis.slopGallery!.player)
  expect(player).toBeDefined()
  expect(Math.abs(player!.position.y - y)).toBeLessThan(0.06)
  expect(Math.hypot(player!.position.x - x, player!.position.z - z)).toBeLessThan(0.06)
}
// ?world_reach in the production build: with `room`, starting in the Bastion loads nothing of any other room but the far sides of its openings – no meshes, lamps, curios or hung works, and the physics runs without waiting for the rest of the gallery – and with `neighbors`, the Sienna brings exactly the rooms its relations list.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: ?world_reach limits the loading to the spawn room and its neighbors', async () => {
  const errors: Array<string> = []
  const watchErrors = (page: Page) => {
    page.on('pageerror', error => errors.push(String(error)))
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
  }
  {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics: 'fast',
      room: 'bastion',
      world_reach: 'room',
      width: '800',
      height: '450',
    })
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-world-reach-room'})
    const {page} = gallery
    watchErrors(page)
    await waitForLoadingItems(page)
    const state = await snapshot(page)
    expect(state.worldReach).toEqual({
      mode: 'room',
      rooms: ['bastion'],
    })
    expect(state.room).toBe('bastion')
    // Only the works hanging in the Bastion built a model – it has no portrait slots, so none did – while the collection keeps every work.
    expect(state.registered).toBe(0)
    expect(state.portraits.length).toBeGreaterThan(0)
    expect(state.portraits.every(portrait => portrait.physical === undefined)).toBe(true)
    // The Bastion’s helmet lies about, the other rooms’ curios never came into the world.
    const props = state.props.map(prop => prop.id)
    expect(props).toContain('prop-helmet')
    for (const foreign of ['prop-pumpkin', 'prop-hatchet', 'prop-painting-set', 'prop-palette-knife']) {
      expect(props).not.toContain(foreign)
    }
    const analysis = await callWebmcpTool(page, 'analyze_world') as WorldAnalysis
    // Exactly the Bastion’s lamps exist.
    expect(analyzedLamps(analysis)).toEqual(lampsOf(['bastion']))
    // The far sides of the Bastion’s openings (in the Forge’s vestibule wall, the Lodge’s east wall and the Oculus’ apse walls) seal it against the void; apart from parts of those walls, whose bounds can spill into a neighbor’s region in the analysis, every other room is entirely absent.
    for (const [room, region] of Object.entries(analysis.rooms)) {
      if (room === 'bastion') {
        continue
      }
      expect({[room]: foreignMeshes(region, ['bastion'])}).toEqual({[room]: []})
      expect({[room]: region.items.length}).toEqual({[room]: 0})
    }
    expect(analysis.rooms.bastion.meshes.length).toBeGreaterThan(0)
    await expectStanding(page, 'bastion')
  }
  {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics: 'fast',
      room: 'sienna',
      world_reach: 'neighbors',
      width: '800',
      height: '450',
    })
    await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-world-reach-neighbors'})
    const {page} = gallery
    watchErrors(page)
    await waitForLoadingItems(page)
    const state = await snapshot(page)
    const reached = ['sienna', ...relations.sienna.rooms]
    expect(state.worldReach).toEqual({
      mode: 'neighbors',
      rooms: reached,
    })
    expect(state.room).toBe('sienna')
    // The works of the reached rooms built their models, the rest of the collection none.
    expect(state.registered).toBe(state.portraits.filter(portrait => reached.some(room => portrait.wallId?.startsWith(`${room}-`))).length)
    expect(state.registered).toBeGreaterThan(0)
    expect(state.registered).toBeLessThan(state.portraits.length)
    const analysis = await callWebmcpTool(page, 'analyze_world') as WorldAnalysis
    expect(analyzedLamps(analysis)).toEqual(lampsOf(reached))
    for (const room of reached) {
      expect({[room]: analysis.rooms[room].meshes.length > 0}).toEqual({[room]: true})
    }
    // Apart from parts of the walls sealing the reached rooms, nothing of the other rooms is in the scene.
    for (const room of ['antechamber', 'banquet', 'bastion', 'exhibition', 'moonfall', 'oculus']) {
      expect({[room]: foreignMeshes(analysis.rooms[room], reached)}).toEqual({[room]: []})
      expect({[room]: analysis.rooms[room].items.length}).toEqual({[room]: 0})
    }
    await expectStanding(page, 'sienna')
  }
  expect(errors).toEqual([])
}, 600_000)
