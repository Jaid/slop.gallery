import {describe, expect, spyOn, test} from 'bun:test'

import {anchorCapture, galleryOptions, resolveGallerySetup} from '../../scripts/lib/headlessGallery.ts'
import {hangDefaultWorks} from '../../src/lib/gallery/defaultPortraits.ts'
import {endRoom, expectRooms, startRoom, usePhysicsHold} from '../../src/lib/gallery/roomLoading.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {resolveArrival} from '../../src/worlds/arrival.ts'
import GalleryMaterials from '../../src/worlds/gallery/GalleryMaterials.ts'
import gallery from '../../src/worlds/gallery/index.ts'
import relations from '../../src/worlds/gallery/relations.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import WorldReach, {readWorldReach} from '../../src/worlds/reach.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

const scope = (query: string) => new WorldReach(gallery, `http://localhost/?world_reach=room&${query}`)
describe('fixed world reach', () => {
  test('normalizes the URL and reports only nondefault overrides', () => {
    for (const value of ['', 'all', 'ROOM', 'true', 'false', '0', 'unknown']) {
      expect(readWorldReach(`?world_reach=${value}`)).toBe('all')
      expect(readQueryOverrides(`http://localhost/?world_reach=${value}`)).toBeUndefined()
    }
    for (const mode of ['room', 'neighbors'] as const) {
      expect(readWorldReach(`?world_reach=${mode}`)).toBe(mode)
      expect(readQueryOverrides(`http://localhost/?world_reach=${mode}`)).toEqual({world_reach: mode})
    }
    expect(Reflect.get(galleryOptions, 'world_reach')).toEqual({type: 'string'})
  })
  test('defaults to the full catalog, independently of arrival', () => {
    for (const query of ['', '?room=lodge', '?spawn=moonfall']) {
      const reach = new WorldReach(gallery, query)
      expect([...reach.rooms]).toEqual(gallery.rooms.map(room => room.id))
    }
    expect(scope('').anchor).toBe('lobby')
  })
  for (const room of gallery.rooms) {
    test(`${room.id}: only the spawn’s geofence, or exactly its declared neighbors`, () => {
      const single = scope(`room=${room.id}`)
      expect([...single.rooms]).toEqual([room.id])
      const neighbors = new WorldReach(gallery, `?room=${room.id}&world_reach=neighbors`)
      expect([...neighbors.rooms]).toEqual([room.id, ...relations[room.id].rooms])
    })
  }
  test('resolves bookmarks before room and uses the same validated arrival as the player', () => {
    expect(scope('room=lobby&spawn=lodge').anchor).toBe('lodge')
    expect(scope('room=lodge&spawn=not-a-bookmark').anchor).toBe('lobby')
    expect(scope('room=unknown').anchor).toBe('lobby')
    expect(scope('spawn=antechamber-overview&development').anchor).toBe('antechamber')
    expect(scope('spawn=sienna-overview&development').anchor).toBe('sienna')
    for (const bookmark of [...gallery.spawnBookmarks(), ...gallery.cameraBookmarks()]) {
      for (const development of ['', '&development']) {
        const query = `?world_reach=room&room=vesper&spawn=${bookmark.id}${development}`
        const arrival = resolveArrival(gallery, query)
        const reach = new WorldReach(gallery, query)
        const [x, y, z] = arrival.pose.position
        const owner = gallery.roomAt(arrival.pose.position) ?? (arrival.flying ? gallery.roomAt([x, y + 1.6, z]) : undefined)
        expect(reach.anchor).toBe(owner?.id ?? gallery.defaultRoom)
      }
    }
  })
  test('single-room worlds keep their own room in both limited modes', () => {
    for (const world of [sandbox, knottingham]) {
      for (const mode of ['room', 'neighbors']) {
        const reach = new WorldReach(world, `?world_reach=${mode}`)
        expect([...reach.rooms]).toEqual([world.defaultRoom])
      }
    }
  })
  test('scope selection does not mutate metadata or reshuffle seeded works', () => {
    const before = hangDefaultWorks(gallery.portraitSlots(), gallery.artworks, 19)
    const lamps = gallery.lamps()
    for (const room of gallery.rooms) {
      const reach = scope(`room=${room.id}`)
      const included = gallery.rooms.filter(entry => reach.includes(entry.id))
      expect(included.flatMap(entry => entry.lamps())).toEqual(lamps.filter(lamp => lamp.room === room.id))
      expect(hangDefaultWorks(gallery.portraitSlots(), gallery.artworks, 19)).toEqual(before)
    }
  })
  test('physics waits for only admitted rooms', () => {
    expectRooms(['moonfall'])
    startRoom('moonfall')
    expect(usePhysicsHold.getState().held).toBe(true)
    endRoom('moonfall')
    expect(usePhysicsHold.getState().held).toBe(false)
    expectRooms([])
  })
})
test('gallery materials are demand-created, shared and disposed once', () => {
  class GuardedMaterials extends GalleryMaterials {
    override get banquet(): never {
      throw new Error('Unneeded Banquet material.')
    }
    override get lodge(): never {
      throw new Error('Unneeded Lodge material.')
    }
    override get vesperWall(): never {
      throw new Error('Unneeded Vesper material.')
    }
  }
  const materials = new GuardedMaterials(false, 1)
  const moonfall = gallery.walls.find(wall => wall.room === 'moonfall')!
  expect(materials.wallMaterial(moonfall)).toBeUndefined()
  expect(materials.surfaceMaterial(moonfall)).toBeUndefined()
  expect(materials.glass('cabin')).toBe(materials.glass('lobby'))
  expect(materials.glass('lobbyWindow')).toBe(materials.glass('lobby'))
  expect(materials.glass('tunnel')).not.toBe(materials.glass('lobby'))
  const stone = materials.castleStone
  expect(materials.castleStone).toBe(stone)
  const dispose = spyOn(stone, 'dispose')
  materials.dispose()
  materials.dispose()
  expect(dispose).toHaveBeenCalledTimes(1)
})
test('headless tools anchor a limited capture before loading but respect explicit anchors', async () => {
  const options = {
    seed: '1',
    graphics: 'fast',
    world_reach: 'room',
  }
  const position = gallery.room('moonfall').spawn.position
  const setup = await resolveGallerySetup(options)
  await anchorCapture(setup, position)
  expect(setup.search.get('room')).toBe('moonfall')
  for (const explicit of [{room: 'lobby'}, {spawn: 'lodge'}]) {
    const anchored = await resolveGallerySetup({
      ...options,
      ...explicit,
    })
    const before = anchored.search.toString()
    await anchorCapture(anchored, position)
    expect(anchored.search.toString()).toBe(before)
  }
  const all = await resolveGallerySetup({
    ...options,
    world_reach: 'all',
  })
  await anchorCapture(all, position)
  expect(all.search.has('room')).toBe(false)
  const outside = await resolveGallerySetup(options)
  await expect(anchorCapture(outside, [9999, 9999, 9999])).rejects.toThrow('outside every room')
})
