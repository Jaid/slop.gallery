import type {Vec3} from '../src/lib/gallery/types.ts'
import type {OutputList} from '../src/lib/vite/outputListPlugin.ts'
import type {WorldAnalysis} from '../src/lib/webmcp/analyzeWorld.ts'
import type {WorldReachMode} from '../src/worlds/base/WorldReach.ts'
import type {Page} from 'puppeteer-core'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'
import {outputListFile} from '../src/lib/vite/outputListPlugin.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

type Visit = {
  mode: WorldReachMode
  room?: string
}

const roomIds = new Set<string>(slopGallery.rooms.map(room => room.id))
/** the names the fills of the openings between two rooms go by, with those rooms, any of which in reach brings them */
const fillNames: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['salon-window', ['salon', 'lobby']],
  ['forge-window', ['forge', 'lobby']],
  ['lodge-tunnel-window', ['lodge', 'corridor']],
  ['lodge-east-window', ['lodge', 'bastion']],
  ['oculus-apse-grilles', ['oculus', 'bastion']],
]
/** The room a mesh, light or item belongs to by the first name along its path that begins with a room’s id, like `lodge-room` or `oculus-east`, or undefined for one of no room; the fills of openings count for their rooms. */
const ownersOf = (path: string): ReadonlyArray<string> => {
  for (const name of path.split('/')) {
    const fill = fillNames.find(([fillName]) => name === fillName)
    if (fill) {
      return fill[1]
    }
    const prefix = name.split('-')[0]
    if (roomIds.has(prefix)) {
      return [prefix]
    }
  }
  return []
}
/** what three warns about on every page with every room in reach, before there was a reach to keep in mind: the stained-glass shadow, and in fast graphics a material without a map */
const knownWarnings = ['shadowMap.transmitted', 'parameter \'map\' has value of undefined']
const settle = async (page: Page) => {
  await waitForFrames(page, 5)
  await page.waitForFunction(() => !globalThis.slopGallery!.snapshot!().loadingItems.length, {
    timeout: 300_000,
    polling: 200,
  })
  await waitForFrames(page, 60)
}
/** the files the page has requested so far, by their paths */
const requestedFiles = (page: Page) => page.evaluate(() => performance.getEntriesByType('resource').map(entry => URL.parse(entry.name)!.pathname.slice(1)))
// What a limited ?world_reach leaves out has to stay out of the scene for good, however the rooms in reach load: geometry, walls, lamps, works and props of other rooms, whose chunks never even download, not even once the camera moves into one of them. The player has to stand at the spawn of the room reached out from.
test.skipIf(Bun.env.LIVE_TEST !== 'true')('production gallery: ?world_reach mounts the start room, its neighbors or every room, and nothing else', async () => {
  const {chunks} = await Bun.file(outputListFile).json() as OutputList
  const roomChunks = slopGallery.rooms.map(({id}) => [id, chunks.find(chunk => chunk.facadeModule === `src/rooms/${id}/components/${id[0].toUpperCase()}${id.slice(1)}Room/index.tsx`)!.fileName] as const)
  const visits: ReadonlyArray<Visit> = [
    {mode: 'all'},
    {mode: 'room'},
    {
      mode: 'room',
      room: 'oculus',
    },
    {
      mode: 'room',
      room: 'bastion',
    },
    {
      mode: 'neighbors',
      room: 'moonfall',
    },
    {
      mode: 'neighbors',
      room: 'lodge',
    },
  ]
  const problems: Array<string> = []
  for (const {mode, room} of visits) {
    const label = `${mode}${room ? ` from ${room}` : ''}`
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      seed: '1',
      graphics: 'fast',
      world_reach: mode,
      ...room ? {room} : {},
      width: '800',
      height: '450',
    })
    const expected = slopGallery.reachOf(`http://localhost/?${setup.search}`)
    await using gallery = await openHeadlessGallery(setup, {
      cacheDir: 'node_modules/.vite-world-reach',
      // Room for every file the page requests, beyond the 250 entries Chrome keeps by default
      initScripts: [() => performance.setResourceTimingBufferSize(10_000)],
    })
    const {page} = gallery
    const errors: Array<string> = []
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warn' && !knownWarnings.some(known => message.text().includes(known))) {
        errors.push(message.text())
      }
    })
    await settle(page)
    const snapshot = await page.evaluate(() => globalThis.slopGallery!.snapshot!())
    expect(snapshot.worldReach).toEqual({
      mode,
      origin: expected.origin,
      rooms: expected.rooms,
    })
    const analysis = await callWebmcpTool(page, 'analyze_world') as WorldAnalysis
    const regions = [...Object.values(analysis.rooms), analysis.elsewhere]
    for (const {path} of regions.flatMap(region => [...region.meshes, ...region.lights])) {
      const owners = ownersOf(path)
      if (owners.length && !owners.some(owner => expected.covers(owner))) {
        problems.push(`${label}: ${path} of ${owners.join(' or ')} is in the scene`)
      }
    }
    const shining = new Set(regions.flatMap(region => region.lights.map(light => light.path.split('/').at(-1)!)))
    for (const lamp of slopGallery.lamps()) {
      if (shining.has(lamp.id) !== expected.covers(lamp.room)) {
        problems.push(`${label}: the lamp ${lamp.id} of ${lamp.room} is ${shining.has(lamp.id) ? 'in the scene' : 'missing'}`)
      }
    }
    // Works and props are items, and the only ones of a room out of reach are works hanging on its walls, which never mount.
    const works = snapshot.portraits.filter(portrait => slopGallery.portraitInReach(portrait, expected))
    expect(snapshot.registered).toBe(works.length)
    for (const item of regions.flatMap(region => region.items)) {
      const portrait = snapshot.portraits.find(candidate => candidate.id === item.id)
      if (portrait && !works.includes(portrait)) {
        problems.push(`${label}: the work ${item.id} hangs in the scene`)
      }
    }
    const player = await page.evaluate(() => globalThis.slopGallery!.player)
    const [x, y, z] = slopGallery.start(`http://localhost/?${setup.search}`).pose.position
    if (!player?.grounded || Math.abs(player.position.y - y) > 0.06 || Math.hypot(player.position.x - x, player.position.z - z) > 0.06) {
      problems.push(`${label}: the player should stand at ${[x, y, z].join(', ')}`)
    }
    // A camera posed in a room out of reach brings nothing of it along.
    const outside = slopGallery.rooms.find(candidate => !expected.covers(candidate.id))
    if (outside) {
      const [outsideX, outsideY, outsideZ] = outside.spawn.position
      const eye: Vec3 = [outsideX, outsideY + 1.6, outsideZ]
      await page.evaluate(position => globalThis.slopGallery!.pose!({position}), eye)
      await waitForFrames(page, 30)
    }
    const requested = new Set(await requestedFiles(page))
    for (const [id, file] of roomChunks) {
      if (requested.has(file) !== expected.covers(id)) {
        problems.push(`${label}: the ${id} room ${requested.has(file) ? 'downloaded' : 'never downloaded'}`)
      }
    }
    problems.push(...errors.map(error => `${label}: ${error}`))
  }
  expect(problems).toEqual([])
}, 900_000)
