import type {Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, spyOn, test} from 'bun:test'

import {galleryHelp, galleryOptions, resolveGallerySetup} from '../../scripts/lib/headlessGallery.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import WorldReach, {cameraFeet, readWorldReach, spawnPosition} from '../../src/worlds/base/WorldReach.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations from '../../src/worlds/gallery/relations.ts'
import SlopGallery from '../../src/worlds/gallery/SlopGallery.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

const reachAt = (...args: ConstructorParameters<typeof WorldReach>) => new WorldReach(...args)
const sorted = (ids: Iterable<string>) => [...ids].toSorted()
const encoder = new TextEncoder
const pack = (data: Record<string, unknown>) => encoder.encode(JSON.stringify(data)).toBase64({
  alphabet: 'base64url',
  omitPadding: true,
})
describe('?world_reach', () => {
  test('only room and neighbors narrow the default all, including packed permalinks', () => {
    for (const mode of ['room', 'neighbors', 'all'] as const) {
      expect(readWorldReach(`?world_reach=${mode}`)).toBe(mode)
      expect(readWorldReach(`?data=${pack({world_reach: mode})}`)).toBe(mode)
    }
    for (const input of ['', '?world_reach', '?world_reach=', '?world_reach=ROOM', '?world_reach=false', '?world_reach=nearby']) {
      expect(readWorldReach(input)).toBe('all')
    }
    expect(readQueryOverrides('?world_reach=all')).toBeUndefined()
    expect(readQueryOverrides('?world_reach=invalid')).toBeUndefined()
    expect(readQueryOverrides('?world_reach=room')).toEqual({world_reach: 'room'})
  })
  test('capture scripts forward the option without changing their default', async () => {
    expect((galleryOptions as Record<string, unknown>).world_reach).toEqual({type: 'string'})
    expect(galleryHelp()).toContain('--world_reach <room|neighbors|all>')
    const options = {
      seed: '1',
      graphics: 'fast',
    }
    const defaults = await resolveGallerySetup(options)
    expect(defaults.search.has('world_reach')).toBe(false)
    const setup = await resolveGallerySetup({
      ...options,
      world_reach: 'neighbors',
      spawn: 'lodge-overview',
    })
    expect(setup.search.get('world_reach')).toBe('neighbors')
    expect(setup.search.get('spawn')).toBe('lodge-overview')
  })
  for (const room of slopGallery.rooms) {
    test(`${room.id}: room mounts only the spawn’s owner; neighbors is the registry’s exact one-hop list`, () => {
      const only = reachAt(slopGallery, `?room=${room.id}&world_reach=room`)
      expect(only.room).toBe(room.id)
      expect([...only.rooms]).toEqual([room.id])
      const neighbors = reachAt(slopGallery, `?room=${room.id}&world_reach=neighbors`)
      expect(sorted(neighbors.rooms)).toEqual(sorted([room.id, ...relations[room.id].rooms]))
      expect(sorted(reachAt(slopGallery, `?room=${room.id}`).rooms)).toEqual(sorted(slopGallery.rooms.map(value => value.id)))
    })
  }
  test('the registry is not a transitive closure or a reciprocal door graph', () => {
    const reach = reachAt(slopGallery, '?room=lodge&world_reach=neighbors')
    expect(sorted(reach.rooms)).toEqual(['bastion', 'corridor', 'lodge', 'oculus'])
    expect(relations.oculus.rooms).toContain('moonfall')
    expect(reach.includes('moonfall')).toBe(false)
    expect(reach.includes('forge')).toBe(false)
  })
  test('spawn and camera bookmarks win over ?room, even if the camera’s feet need floor clamping', () => {
    for (const bookmark of [...slopGallery.spawnBookmarks(), ...slopGallery.cameraBookmarks()]) {
      for (const development of [false, true]) {
        const input = `?spawn=${bookmark.id}&room=vesper&world_reach=room&development=${development}`
        const position = spawnPosition(slopGallery, input)
        const reach = reachAt(slopGallery, input)
        expect(reach.room).toBe(slopGallery.roomAt(position)?.id ?? slopGallery.defaultRoom)
        expect([...reach.rooms]).toEqual([reach.room])
      }
    }
    expect(reachAt(slopGallery, '?spawn=moonfall-stairs&room=vesper&world_reach=room').room).toBe('moonfall')
    expect(reachAt(slopGallery, '?spawn=lodge&room=vesper&world_reach=room').room).toBe('lodge')
    expect(reachAt(slopGallery, '?spawn=not-a-bookmark&room=lodge&world_reach=room').room).toBe('lobby')
    expect(reachAt(slopGallery, '?room=not-a-room&world_reach=room').room).toBe('lobby')
  })
  test('camera bookmark precedence, rejected positions and an unfenced spawn are deterministic', () => {
    const position: Vec3 = [10, 0.2, 10]
    const world = {
      defaultRoom: 'lobby',
      rooms: slopGallery.rooms,
      spawn: slopGallery.spawn,
      cameraBookmarks: () => [{
        id: 'shared',
        position,
        aim: {
          yaw: 0,
          pitch: 0,
        },
        fov: 60,
        ratio: 1,
      }],
      spawnBookmarks: () => [{
        id: 'shared',
        ...slopGallery.room('lodge').spawn,
      }],
      contains: () => true,
      floorHeight: () => 0,
      roomAt: (value: Vec3) => (value[0] === 10 ? slopGallery.room('banquet') : undefined),
      roomById: (id: string) => slopGallery.roomById(id),
      neighborRooms: (id: string) => slopGallery.neighborRooms(id),
    }
    expect(spawnPosition(world, '?spawn=shared')).toEqual([10, 0.04, 10])
    expect(cameraFeet(world, position, true)[1]).toBeCloseTo(-1.4)
    expect(reachAt(world, '?spawn=shared&world_reach=room').room).toBe('banquet')
    expect(reachAt({
      ...world,
      contains: () => false,
    }, '?spawn=shared&world_reach=room').room).toBe('lobby')
    expect(reachAt({
      ...world,
      roomAt: () => {},
    }, '?spawn=shared&world_reach=room').room).toBe('lobby')
  })
  test('single-room worlds keep their room at every reach', () => {
    for (const world of [sandbox, knottingham]) {
      for (const mode of ['room', 'neighbors', 'all']) {
        expect([...reachAt(world, `?world_reach=${mode}`).rooms]).toEqual([world.defaultRoom])
      }
    }
  })
  test('world registries enumerate only reached rooms, while bookmarks and slots stay complete and stable', () => {
    const world = new SlopGallery
    const reach = reachAt(world, '?room=lodge&world_reach=room')
    Object.defineProperty(world, 'reach', {value: reach})
    const slots = world.portraitSlots()
    const spawns = world.spawnBookmarks()
    const cameras = world.cameraBookmarks()
    const unrelatedLamps = spyOn(world.room('banquet'), 'lamps')
    const unrelatedAmbience = spyOn(world.room('lobby'), 'ambiences')
    try {
      expect(world.reachedRooms.map(room => room.id)).toEqual(['lodge'])
      const position = world.room('lodge').spawn.position
      expect(world.reachesPortrait({
        hung: false,
        position,
      })).toBe(true)
      // The hanging wall wins over the position if they disagree, just as spectation and the collection do.
      expect(world.reachesPortrait({
        hung: true,
        wallId: 'lobby-north',
        position,
      })).toBe(false)
      expect(world.reachesPortrait({
        hung: true,
        wallId: 'lodge-east',
        position: world.spawn.position,
      })).toBe(true)
      expect(world.reachesPortrait({
        hung: false,
        position: [10_000, 0, 10_000],
      })).toBe(false)
      expect(world.lamps().every(lamp => lamp.room === 'lodge')).toBe(true)
      expect(world.lamps()).toHaveLength(world.room('lodge').room.lamps.size)
      expect(world.ambiences().map(sound => sound.room)).toEqual(['lodge'])
      expect(unrelatedLamps).not.toHaveBeenCalled()
      expect(unrelatedAmbience).not.toHaveBeenCalled()
      expect(world.rooms).toHaveLength(13)
      expect(world.portraitSlots()).toEqual(slots)
      expect(world.spawnBookmarks()).toEqual(spawns)
      expect(world.cameraBookmarks()).toEqual(cameras)
      expect(reach.includes('moonfall')).toBe(false)
      // A new camera/body position does not redefine the startup scope.
      world.roomAt(world.room('moonfall').spawn.position)
      expect(world.reach).toBe(reach)
      expect([...reach.rooms]).toEqual(['lodge'])
    } finally {
      unrelatedLamps.mockRestore()
      unrelatedAmbience.mockRestore()
    }
  })
})
