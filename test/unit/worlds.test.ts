import type {PlayerPose, Vec3} from '../../src/lib/gallery/types.ts'
import type {PlacedLamp} from '../../src/worlds/base/PlacedRoom.ts'
import type {ReactElement} from 'react'

import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'

import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {knotGalleryBounds} from '../../src/lib/gallery/knotGallery.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import PlayerSession from '../../src/lib/gallery/PlayerSession.ts'
import {asPortrait, slotPlacard} from '../../src/lib/placement/portraitSlots.ts'
import {placementIssue, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import world from '../../src/worlds/current.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import galleryWalls from '../../src/worlds/gallery/walls.ts'
import {defaultWorld, readWorld, selectWorld, worldIds, worldParameters, worlds} from '../../src/worlds/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import worldModules from '../../src/worlds/modules.ts'
import sandbox from '../../src/worlds/sandbox/cell.ts'
import CellSandbox from '../../src/worlds/sandbox/CellSandbox.ts'
import loadSandbox from '../../src/worlds/sandbox/load.ts'
import studio from '../../src/worlds/sandbox/studio.ts'
import StudioSandbox from '../../src/worlds/sandbox/StudioSandbox.ts'

const root = resolve(import.meta.dir, '../..')
/** how many of the items come in each ratio */
const ratios = (items: ReadonlyArray<{ratio: string}>) => Object.fromEntries(Object.entries(Object.groupBy(items, item => item.ratio)).map(([ratio, group]) => [ratio, group!.length]))
const farKnotPosition: Vec3 = [knotGalleryBounds.maxX - 2, 0.04, knotGalleryBounds.northZ + 2]
describe('world selection', () => {
  test('opens the gallery without parameters', () => {
    expect(defaultWorld).toBe('gallery')
    expect(selectWorld('')).toBe('gallery')
    expect(selectWorld('?seed=1&spawn=lobby')).toBe('gallery')
    expect(readWorld('http://localhost/')).toBe('gallery')
  })
  test('opens the world holding the room ?room names, even next to another world’s parameters', () => {
    expect(selectWorld('?room=arena')).toBe('knottingham')
    expect(selectWorld('?room=cell')).toBe('sandbox')
    expect(selectWorld('?room=studio')).toBe('sandbox')
    expect(selectWorld('?room=lobby')).toBe('gallery')
    expect(selectWorld('?room=cell&candidate=grok')).toBe('sandbox')
    expect(selectWorld('?room=arena&item=prop-orb-spook')).toBe('knottingham')
    expect(readWorld('https://slop.gallery/?room=arena')).toBe('knottingham')
    expect(readWorld('https://slop.gallery/?room=cell&spawn=center')).toBe('sandbox')
  })
  test('opens every world by each of its rooms', () => {
    for (const instance of [slopGallery, knottingham, sandbox, studio]) {
      for (const room of instance.rooms) {
        expect(selectWorld(`?room=${room.id}`)).toBe(instance.id)
      }
    }
  })
  test('leaves a ?room no world has, or none at all, to the worlds’ own parameters', () => {
    expect(selectWorld('?room=missing')).toBe('gallery')
    expect(selectWorld('?room')).toBe('gallery')
    expect(selectWorld('?room=missing&rarity=edit')).toBe('knottingham')
    expect(selectWorld('?room=lobby&item=prop-orb-spook')).toBe('sandbox')
  })
  test('opens Knottingham for any of its own parameters, also bare ones', () => {
    for (const parameter of worldParameters.knottingham) {
      expect(selectWorld(`?${parameter}=1`)).toBe('knottingham')
      expect(selectWorld(`?seed=3&${parameter}`)).toBe('knottingham')
    }
  })
  test('opens the Sandbox for ?item', () => {
    expect(selectWorld('?item=prop-orb-spook')).toBe('sandbox')
    expect(selectWorld('?seed=3&item=prop-orb-spook,prop-orb-horror')).toBe('sandbox')
    expect(selectWorld('?item')).toBe('sandbox')
    expect(readWorld('https://slop.gallery/?item=prop-orb-halloween')).toBe('sandbox')
  })
  test('every world has a title and storage key of its own', async () => {
    expect(worldIds).toEqual(['gallery', 'knottingham', 'sandbox'])
    const storageKeys = new Set(worldIds.map(id => worlds[id].storageKey))
    const titles = new Set(worldIds.map(id => worlds[id].title))
    expect(storageKeys.size).toBe(worldIds.length)
    expect(titles.size).toBe(worldIds.length)
    // Bun imports the wallpaper as its file.
    expect(await Bun.file(worlds.gallery.wallpaper).exists()).toBe(true)
  })
  test('outside a page, the current world is the gallery', () => {
    expect(world).toBe(slopGallery)
  })
  test('the Sandbox holds the Studio for ?room=studio and the Cell otherwise', async () => {
    expect(await loadSandbox('http://localhost/?room=studio')).toBe(studio)
    expect(await loadSandbox('http://localhost/?room=studio&item=prop-orb-spook')).toBe(studio)
    for (const url of ['http://localhost/', 'http://localhost/?room=cell', 'http://localhost/?item=prop-orb-spook', 'http://localhost/?room=studios']) {
      expect(await loadSandbox(url)).toBe(sandbox)
    }
  })
})
describe('worlds', () => {
  test('match their catalog entries', () => {
    for (const instance of [slopGallery, knottingham, sandbox, studio]) {
      // Only the browser storage reads the storage key, from the catalog.
      const {storageKey: _, ...info} = worlds[instance.id]
      expect(instance).toMatchObject(info)
    }
  })
  test('use independent spawns, bounds and collections', () => {
    expect(knottingham.contains(knottingham.spawn.position)).toBe(true)
    expect(slopGallery.contains(slopGallery.spawn.position)).toBe(true)
    expect(knottingham.contains(farKnotPosition)).toBe(true)
    expect(slopGallery.contains(farKnotPosition)).toBe(false)
    expect(knottingham.contains([0, 0, knotGalleryBounds.northZ - 1])).toBe(false)
    expect(knottingham.floorHeight(farKnotPosition)).toBe(0)
    expect(knottingham.groundSurface('arena', [0, 0, 0])).toBe('generic')
    expect(knottingham.artworks).toEqual([])
    expect(slopGallery.artworks.length).toBeGreaterThan(0)
  })
  test('Knottingham is a single room, the Arena, which holds its spawn', () => {
    expect(knottingham.rooms.map(room => room.id)).toEqual(['arena'])
    const arena = knottingham.room('arena')
    expect(arena.title).toBe('Arena')
    expect(knottingham.roomAt(knottingham.spawn.position)).toBe(arena)
    expect(knottingham.roomAt(farKnotPosition)).toBe(arena)
    expect(knottingham.roomAt([0, 0, knotGalleryBounds.northZ - 5])).toBeUndefined()
    expect(knottingham.placement.contains(knottingham.placement.recoveryPosition)).toBe(true)
  })
  test('the Sandbox is a single room, the Cell, as large and high as its layout, which holds its spawn and is sealed by the Arena’s walls, a door shutting its north wall’s arch without ?item', () => {
    expect(sandbox.items).toEqual([])
    expect(sandbox.rooms.map(room => room.id)).toEqual(['cell'])
    const cell = sandbox.room('cell')
    expect(cell.title).toBe('Cell')
    expect(cell.size).toEqual(cell.room.layout.size)
    expect(cell.height).toBe(cell.room.layout.height)
    expect(cell.room.layout.plan).toBe('closed')
    expect(sandbox.artworks).toBe(slopGallery.artworks)
    expect(sandbox.lamps().map(lamp => lamp.id)).toEqual(['cell-chandelier'])
    expect(sandbox.roomAt(sandbox.spawn.position)).toBe(cell)
    expect(sandbox.contains(sandbox.spawn.position)).toBe(true)
    expect(sandbox.contains([0, 1, cell.size[1]])).toBe(false)
    expect(sandbox.floorHeight(sandbox.spawn.position)).toBe(0)
    expect(sandbox.placement.contains(sandbox.placement.recoveryPosition)).toBe(true)
    expect(sandbox.walls.map(wall => wall.id).toSorted()).toEqual(['cell-east', 'cell-north', 'cell-south', 'cell-west'])
    for (const wall of sandbox.walls) {
      expect(wall.height).toBe(cell.height)
    }
    // The only opening is the arch the door fills, and nothing lies behind it.
    const holes = sandbox.walls.flatMap(wall => (wall.holes ?? []).map(hole => `${wall.id}/${hole.name}`))
    expect(holes).toEqual(['cell-north/door'])
    const [x, , z] = sandbox.spawn.position
    const [width, depth] = cell.size
    expect(sandbox.contains([0, 1, -depth / 2 - 1])).toBe(false)
    expect(sandbox.placement.contains([0, 1, -depth / 2 - 0.1])).toBe(false)
    expect(sandbox.wallDistance([x, 1, z], [1, 0, 0])).toBeGreaterThan(width / 2 - x - wallFace)
    expect(sandbox.wallDistance([x, 1, z], [1, 0, 0])).toBeLessThan(width / 2 - x + 0.1)
    expect(sandbox.wallDistance([4, 1, z], [0, 0, -1])).toBeLessThan(z + depth / 2 + 0.1)
    expect(sandbox.wallDistance([x, cell.height + 1, z], [1, 0, 0])).toBe(Infinity)
  })
  test('with a single item, the Cell’s north wall opens into a round vestibule, part of it and reached through the arch alone', () => {
    const single = new CellSandbox(['prop-orb-halloween'])
    const cell = single.room('cell')
    const vestibule = cell.room.layout.vestibule!
    expect(cell.room.layout.plan).toBe('single')
    expect(single.lamps().map(lamp => lamp.id)).toEqual(['cell-chandelier', 'cell-led'])
    expect(single.walls.map(wall => wall.id).toSorted()).toEqual(['cell-east', 'cell-north', 'cell-south', 'cell-vestibule', 'cell-west'])
    const holes = single.walls.flatMap(wall => (wall.holes ?? []).map(hole => `${wall.id}/${hole.name}`))
    expect(holes).toEqual(['cell-north/vestibule', 'cell-vestibule/cell'])
    const [vestibuleX, vestibuleZ] = vestibule.center
    const northZ = -cell.size[1] / 2
    const half = vestibule.arch.width / 2
    // A passage leads on from the arch to where the vestibule’s wall touches it.
    const {passage} = cell.room.layout
    expect(passage).toBeGreaterThan(wallFace * 2)
    expect(vestibuleZ + vestibule.radius).toBeCloseTo(northZ - passage, 9)
    expect(single.roomAt([vestibuleX, 1, vestibuleZ])).toBe(cell)
    expect(single.contains([vestibuleX + 2, 1, vestibuleZ])).toBe(true)
    expect(single.contains([vestibuleX + vestibule.radius, 1, vestibuleZ])).toBe(false)
    for (const z of [northZ, northZ - passage / 2, northZ - passage]) {
      expect(single.roomAt([vestibuleX, 1, z])).toBe(cell)
      expect(single.contains([vestibuleX, 1, z])).toBe(true)
      expect(single.placement.contains([vestibuleX + half - 0.1, 1, z - 0.1])).toBe(true)
      expect(single.placement.contains([vestibuleX + half + 0.3, 1, z - 0.1])).toBe(false)
    }
    expect(single.placement.contains([vestibuleX, 1, vestibuleZ - vestibule.radius - 0.1])).toBe(false)
    // Straight through the arch, across the vestibule to the far side of its wall.
    const [, , z] = single.spawn.position
    expect(single.wallDistance([vestibuleX, 1, z], [0, 0, -1])).toBeGreaterThan(z - vestibuleZ + vestibule.radius - wallFace)
  })
  test('the Sandbox’s Studio is a single room, by default a floor 8 × 8 m between four walls 8 m high under a ceiling, its north-western corner the world’s origin, its floor spreading toward +x and +z, its spawn 4 m in from the west wall and 5 m from the north wall, looking at the work right ahead, lit by the Cell’s chandelier lamp, a faint, cool one by the west wall and a faint moon through openings in its ceiling, in shafts that hardly show, all its works framed in the Cell’s frame', () => {
    const plain = new StudioSandbox(0)
    expect(plain.id).toBe('sandbox')
    expect(plain.rooms.map(room => room.id)).toEqual(['studio'])
    const room = plain.room('studio')
    const cell = sandbox.room('cell')
    const [width, depth] = room.size
    expect(room.title).toBe('Studio')
    expect(width - wallFace * 2).toBeCloseTo(8, 12)
    expect(depth - wallFace * 2).toBeCloseTo(8, 12)
    expect(room.height).toBe(8)
    expect(room.room.frame).toBe(choiceFrames(cell.room.frame!)[0])
    expect(plain.artworks).toEqual(slopGallery.artworks.filter(artwork => artwork.ratio === '1:1'))
    expect(room.mood).toBeUndefined()
    expect(room.skybox).toBeNull()
    expect(plain.skybox('night')).toBeNull()
    expect(room.volumetricSun).toBe(0.05)
    expect(room.map!.frame).toEqual([-width / 2, -depth / 2, width, depth])
    // Where floor and the north and west walls’ faces meet.
    for (const value of room.toWorld(room.room.corner)) {
      expect(value).toBeCloseTo(0, 12)
    }
    expect(room.center[0]).toBeCloseTo(width / 2 - wallFace, 12)
    expect(room.center[1]).toBeCloseTo(depth / 2 - wallFace, 12)
    // The Cell’s lamp, dimmed and reaching 20 m, over the middle of the floor, 4 m up, and a faint slate-blue one a tenth of the way east, seven tenths of the way south and two fifths of the way up, its shadow blurred 1° wide.
    const [chandelier] = sandbox.lamps()
    const [primary, secondary] = plain.lamps()
    expect(primary).toEqual({
      ...chandelier,
      id: 'studio-primary-lamp',
      room: 'studio',
      position: room.toWorld([0, 4, 0]),
      strength: 30,
      decay: 2,
      range: 20,
    })
    expect(secondary.position.map(value => Math.round(value * 1e9) / 1e9)).toEqual([0.8, 3.2, 5.6])
    const expected: PlacedLamp = {
      ...chandelier as Exclude<PlacedLamp, {kind: 'spot'}>,
      id: 'studio-secondary-lamp',
      room: 'studio',
      position: secondary.position,
      strength: 5,
      decay: 1,
      tint: '#4d5e7d',
      softShadow: {
        blurAngle: Math.PI / 180,
        softSamples: 16,
      },
    }
    expect(secondary).toEqual(expected)
    // Looking north and a little down.
    expect(plain.spawn.position).toEqual([4, 0.04, 5])
    expect(plain.spawn.yaw).toBe(0)
    expect(plain.spawn.pitch).toBeCloseTo(-8 * Math.PI / 180, 12)
    expect(plain.roomAt(plain.spawn.position)).toBe(room)
    expect(plain.contains(plain.spawn.position)).toBe(true)
    expect(plain.floorHeight(plain.spawn.position)).toBe(0)
    expect(plain.placement.contains(plain.placement.recoveryPosition)).toBe(true)
    expect(plain.walls.map(wall => [wall.id, wall.width, wall.height, wall.holes?.map(hole => hole.name) ?? [], wall.cornice])).toEqual([
      ['studio-north', width, room.height, [], false],
      ['studio-east', depth, room.height, [], false],
      ['studio-south', width, room.height, [], false],
      ['studio-west', depth, room.height, [], false],
    ])
    const [north, east, south, west] = plain.walls
    expect(north.center[2]).toBeCloseTo(-wallFace, 12)
    expect(east.center[0]).toBeCloseTo(width - wallFace, 12)
    expect(south.center[2]).toBeCloseTo(depth - wallFace, 12)
    expect(west.center[0]).toBeCloseTo(-wallFace, 12)
    // Every corner’s trim is mitered.
    expect(plain.walls.map(wall => wall.miters)).toEqual(plain.walls.map(() => [1, 1]))
    // A body fits up to the ceiling over all of the floor, and nowhere past the walls.
    expect(plain.contains([1, 1, 1])).toBe(true)
    expect(plain.contains([width - 1, 1, depth - 1])).toBe(true)
    expect(plain.contains([5, room.height - 0.5, 5])).toBe(true)
    expect(plain.contains([5, room.height + 0.5, 5])).toBe(false)
    expect(plain.contains([width + 0.5, 1, 5])).toBe(false)
    expect(plain.contains([5, 1, depth + 0.5])).toBe(false)
    expect(plain.contains([-1, 1, 5])).toBe(false)
    expect(plain.contains([5, -1, 5])).toBe(false)
    // Rays meet the walls on every side, and nothing over them.
    expect(plain.wallDistance([5, 1, 3], [-1, 0, 0])).toBeGreaterThan(5)
    expect(plain.wallDistance([5, 1, 3], [-1, 0, 0])).toBeLessThan(5.4)
    expect(plain.wallDistance([5, 1, 3], [0, 0, -1])).toBeLessThan(3.4)
    expect(plain.wallDistance([5, 1, 3], [1, 0, 0])).toBeLessThan(width - wallFace * 2 - 5 + 0.4)
    expect(plain.wallDistance([5, 1, 3], [0, 0, 1])).toBeLessThan(depth - wallFace * 2 - 3 + 0.4)
    expect(plain.wallDistance([5, room.height + 1, 5], [-1, 0, 0])).toBe(Infinity)
  })
  test('the Studio has a portrait slot for each ratio of the default works, every one a valid hanging spot with the other filled, in rooms of every size', () => {
    for (const sized of [studio, ...Array.from({length: 20}, (_, index) => new StudioSandbox(index + 1))]) {
      const slots = sized.portraitSlots()
      expect(Object.keys(ratios(slots)).toSorted()).toEqual(Object.keys(ratios(sized.artworks)).toSorted())
      expect(Object.values(ratios(slots))).toEqual(Object.keys(ratios(slots)).map(() => 1))
      const occupied = slots.map(asPortrait)
      for (const slot of slots) {
        const wall = sized.placement.wall(slot.wallId)!
        expect(slot.rotation).toBe(wall.rotation)
        const hanging = wallPosition(wall, wallCoordinates(wall, slot.position), slot.position[1])
        for (const [axis, value] of slot.position.entries()) {
          expect(value).toBeCloseTo(hanging[axis], 6)
        }
        expect(placementIssue(wall, slot.position, slot.width, slot.height, occupied, {
          ignoreId: slot.id,
          placard: slotPlacard(slot),
        })).toBe('')
      }
    }
  })
  test('the Sandbox’s walls have portrait slots, at most one for every default work of each ratio, every one a valid hanging spot with all the others filled', () => {
    const slots = sandbox.portraitSlots()
    // Every default work’s ratio has a slot, and no ratio has more slots than works; slots of other ratios wait for works of their own.
    const available = ratios(slots)
    for (const [ratio, count] of Object.entries(ratios(sandbox.artworks))) {
      expect(available[ratio]).toBeGreaterThan(0)
      expect(available[ratio]).toBeLessThanOrEqual(count)
    }
    const occupied = slots.map(asPortrait)
    const ids = new Set(slots.map(slot => slot.id))
    expect(ids.size).toBe(slots.length)
    expect(new Set(slots.map(slot => slot.wallId))).toEqual(new Set(['cell-north', 'cell-east', 'cell-south', 'cell-west']))
    for (const slot of slots) {
      const wall = sandbox.placement.wall(slot.wallId)!
      expect(slot.rotation).toBe(wall.rotation)
      // Where works hang in front of the wall, not inside it.
      const hanging = wallPosition(wall, wallCoordinates(wall, slot.position), slot.position[1])
      for (const [axis, value] of slot.position.entries()) {
        expect(value).toBeCloseTo(hanging[axis], 6)
      }
      expect(placementIssue(wall, slot.position, slot.width, slot.height, occupied, {
        ignoreId: slot.id,
        placard: slotPlacard(slot),
      })).toBe('')
      expect(sandbox.placement.contains(slot.position)).toBe(true)
    }
  })
  test('the gallery starts in the Lobby, between its north wall and the glass floor', () => {
    expect(slopGallery.defaultRoom).toBe('lobby')
    const [, y, z] = slopGallery.spawn.position
    expect(slopGallery.roomAt(slopGallery.spawn.position)?.id).toBe('lobby')
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(0.1)
    expect(z).toBeGreaterThan(lobby.northZ)
    expect(z).toBeLessThan(lobby.opening.center[1] - lobby.opening.size[1] / 2)
  })
  test('every spawn stands just above its floor, never inside it', () => {
    const misplaced: Array<string> = []
    for (const instance of [slopGallery, knottingham, sandbox, studio]) {
      for (const room of instance.rooms) {
        for (const [id, {position}] of [[room.id, room.spawn] as const, ...room.spawns().map(bookmark => [bookmark.id, bookmark] as const)]) {
          const clearance = position[1] - instance.floorHeight(position)
          if (clearance < 0 || clearance > 0.05) {
            misplaced.push(`${id}: ${clearance.toFixed(3)} m`)
          }
        }
      }
    }
    expect(misplaced).toEqual([])
  })
  test('the gallery’s walls module, which the build bakes the architecture from, holds exactly the world’s walls', () => {
    expect(galleryWalls.map(wall => wall.room)).toEqual(slopGallery.rooms.flatMap(room => room.walls().map(() => room.id)))
    expect(galleryWalls).toEqual(slopGallery.walls)
  })
  test('the gallery’s rooms show its sky, except those without a view outside, which show none', () => {
    const skyless = slopGallery.rooms.filter(room => room.skybox === null).map(room => room.id)
    expect(skyless.toSorted()).toEqual(['corridor', 'moonfall'])
    for (const room of slopGallery.rooms) {
      if (room.skybox !== null) {
        expect(room.skybox).toBe('sky')
      }
    }
    expect(slopGallery.room(slopGallery.defaultRoom).skybox).toBe('sky')
    expect(slopGallery.skybox('sky')?.isNode).toBe(true)
    expect(slopGallery.skybox('sky')).toBe(slopGallery.skybox('sky'))
    expect(slopGallery.skybox('void')).toBeNull()
  })
  test('Knottingham names no skybox, so its hall keeps its own background', () => {
    expect(knottingham.rooms.map(room => room.skybox)).toEqual([undefined])
    expect(knottingham.skybox('sky')).toBeNull()
  })
})
test('a Knottingham session retains poses beyond the gallery’s bounds and falls back to its own spawn', () => {
  const session = new PlayerSession(knottingham)
  const pose: PlayerPose = {
    position: farKnotPosition,
    yaw: 0.8,
    pitch: -0.1,
  }
  session.capture(pose)
  expect(session.snapshot()).toEqual(pose)
  session.restore(pose)
  expect(session.snapshot()).toEqual(pose)
  session.restore({
    position: [knotGalleryBounds.maxX + 1, 0, 0],
    yaw: 0,
    pitch: 0,
  })
  expect(session.snapshot()).toEqual(knottingham.spawn)
})
const transpilers = {
  ts: new Bun.Transpiler({loader: 'ts'}),
  tsx: new Bun.Transpiler({loader: 'tsx'}),
}
/** Every source module the files import when they run, all the way down. Type-only imports vanish when transpiled, and dynamic imports, like the lazy components’, only run later. */
const staticImports = (files: ReadonlyArray<string>) => {
  const seen = new Set<string>
  const pending = files.map(file => resolve(root, file))
  while (pending.length) {
    const file = pending.pop()!
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    for (const {kind, path} of transpilers[file.endsWith('.tsx') ? 'tsx' : 'ts'].scanImports(readFileSync(file, 'utf8'))) {
      if (kind === 'dynamic-import') {
        continue
      }
      const resolved = resolve(Bun.resolveSync(path, dirname(file)))
      if (resolved.startsWith(root) && !resolved.includes('node_modules') && /\.tsx?$/u.test(resolved)) {
        pending.push(resolved)
      }
    }
  }
  return seen
}
const worldFiles = Object.values(worldModules).flat()
test('world modules never import the current world, which waits for them to load', () => {
  const imported = staticImports(worldFiles)
  expect(imported.has(resolve(root, 'src/worlds/current.ts'))).toBe(false)
  expect(imported.size).toBeGreaterThan(50)
})
test('the page never imports a world itself, which only loads once its URL chose it', () => {
  const imported = staticImports(['src/main.tsx'])
  expect(worldFiles.filter(file => imported.has(resolve(root, file)))).toEqual([])
  expect(imported.has(resolve(root, 'src/worlds/current.ts'))).toBe(true)
})
test('the Sandbox with the Studio loads nothing of the Cell, and the one with the Cell nothing of the Studio', () => {
  const rooms = (files: ReadonlyArray<string>) => new Set(staticImports(files).values().flatMap(file => /[/\\]src[/\\]rooms[/\\](\w+)[/\\]/u.exec(file)?.slice(1) ?? []))
  expect(rooms(['src/worlds/sandbox/studio.ts', 'src/rooms/studio/components/StudioRoom/index.tsx'])).toEqual(new Set(['base', 'lib', 'studio']))
  expect(rooms(['src/worlds/sandbox/cell.ts', 'src/rooms/cell/components/CellRoom/index.tsx'])).not.toContain('studio')
  expect(rooms(['src/worlds/sandbox/cell.ts'])).toContain('cell')
})
test('Knottingham’s Arena holds its lobby, spectation and exhibition, without gallery props', async () => {
  const result = await Bun.build({
    entrypoints: [resolve(root, 'src/rooms/arena/components/ArenaRoom/index.tsx')],
    target: 'bun',
    define: {'process.env.NODE_ENV': JSON.stringify('production')},
    plugins: [
      {
        name: 'scene-children',
        setup(build) {
          build.onResolve({filter: /^#component\//u}, args => ({
            path: args.path,
            namespace: 'scene-stub',
          }))
          build.onLoad({
            filter: /.*/u,
            namespace: 'scene-stub',
          }, ({path}) => ({
            contents: `export default ${JSON.stringify(path)}`,
            loader: 'js',
          }))
        },
      },
    ],
  })
  expect(result.success).toBe(true)
  const source = await result.outputs[0].text()
  const {default: room} = await import(`data:text/javascript;base64,${Buffer.from(source).toBase64()}`) as {default: () => ReactElement<{children: Array<ReactElement>}>}
  const children = room().props.children
  expect(children.map(child => child.type)).toEqual([
    '#component/KnotLobby',
    '#component/KnotSpectation',
    '#component/KnotExhibition',
  ])
})
