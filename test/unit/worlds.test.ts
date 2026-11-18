import type {PlayerPose, Vec3} from '../../src/lib/gallery/types.ts'
import type {ReactElement} from 'react'

import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {knotGalleryBounds} from '../../src/lib/gallery/knotGallery.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import PlayerSession from '../../src/lib/gallery/PlayerSession.ts'
import {asPortrait} from '../../src/lib/placement/portraitSlots.ts'
import {placementIssue, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import world from '../../src/worlds/current.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import galleryWalls from '../../src/worlds/gallery/walls.ts'
import {defaultWorld, readWorld, selectWorld, worldIds, worldParameters, worlds} from '../../src/worlds/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'
import Sandbox from '../../src/worlds/sandbox/Sandbox.ts'

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
    expect(selectWorld('?room=lobby')).toBe('gallery')
    expect(selectWorld('?room=cell&candidate=grok')).toBe('sandbox')
    expect(selectWorld('?room=arena&item=prop-orb-spook')).toBe('knottingham')
    expect(readWorld('https://slop.gallery/?room=arena')).toBe('knottingham')
    expect(readWorld('https://slop.gallery/?room=cell&spawn=center')).toBe('sandbox')
  })
  test('opens every world by each of its rooms', () => {
    for (const instance of [slopGallery, knottingham, sandbox]) {
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
})
describe('worlds', () => {
  test('match their catalog entries', () => {
    for (const instance of [slopGallery, knottingham, sandbox]) {
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
    const single = new Sandbox(['prop-orb-halloween'])
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
      expect(placementIssue(wall, slot.position, slot.width, slot.height, occupied, slot.id, slot.labelAbove)).toBe('')
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
    for (const instance of [slopGallery, knottingham, sandbox]) {
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
const worldModules = ['src/worlds/gallery/index.ts', 'src/worlds/knottingham/index.ts', 'src/worlds/sandbox/index.ts']
test('world modules never import the current world, which waits for them to load', () => {
  const imported = staticImports(worldModules)
  expect(imported.has(resolve(root, 'src/worlds/current.ts'))).toBe(false)
  expect(imported.size).toBeGreaterThan(50)
})
test('the page never imports a world itself, which only loads once its URL chose it', () => {
  const imported = staticImports(['src/main.tsx'])
  expect(worldModules.filter(file => imported.has(resolve(root, file)))).toEqual([])
  expect(imported.has(resolve(root, 'src/worlds/current.ts'))).toBe(true)
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
