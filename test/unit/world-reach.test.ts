import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'
import type WorldReach from '../../src/worlds/base/WorldReach.ts'
import type {Activation} from '../../src/worlds/gallery/activations.ts'

import {describe, expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player/motor'

import {openingFills, roomParts} from '../../src/components/World/index.tsx'
import {GalleryPlacementSpace} from '../../src/lib/placement/GalleryPlacementSpace.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {readWorldReach} from '../../src/worlds/base/WorldReach.ts'
import activations from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import SlopGallery from '../../src/worlds/gallery/SlopGallery.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/cell.ts'

const reach = (search: string) => slopGallery.reachOf(`http://localhost/${search}`)
const allRooms = slopGallery.rooms.map(room => room.id)
/** a placement space of the gallery with only the walls of the rooms in reach */
const placementWithin = (within: WorldReach) => new GalleryPlacementSpace(slopGallery.walls, {
  contains: position => slopGallery.contains(position),
  floorHeight: position => slopGallery.floorHeight(position),
}, {
  covers: wall => within.covers(wall.room),
  recovery: () => [0, 1, 4],
})
describe('?world_reach', () => {
  test('reads room, neighbors and all, all by default and for anything else', () => {
    expect(readWorldReach('?world_reach=room')).toBe('room')
    expect(readWorldReach('?world_reach=neighbors')).toBe('neighbors')
    for (const search of ['', '?world_reach', '?world_reach=ROOM', '?world_reach=neighbours', '?world_reach=1']) {
      expect(readWorldReach(search)).toBe('all')
    }
    expect(readQueryOverrides('http://localhost/?world_reach=room')).toEqual({world_reach: 'room'})
    expect(readQueryOverrides('http://localhost/?world_reach=all')).toBeUndefined()
  })
  test('all mounts every room', () => {
    for (const search of ['', '?world_reach=all', '?world_reach=all&room=oculus']) {
      const all = reach(search)
      expect(all.rooms).toEqual(allRooms)
      expect(all.limited).toBe(false)
      expect(all.covers('exhibition')).toBe(true)
    }
    expect(slopGallery.reach.rooms).toEqual(allRooms)
  })
  test('room mounts only the room the spawn belongs to, the Lobby without ?room or ?spawn', () => {
    expect(reach('?world_reach=room').rooms).toEqual(['lobby'])
    for (const room of allRooms) {
      const start = slopGallery.start(`http://localhost/?room=${room}`)
      expect(start.pose).toMatchObject(slopGallery.room(room).spawn)
      const within = reach(`?world_reach=room&room=${room}`)
      expect(within.origin).toBe(room)
      expect(within.rooms).toEqual([room])
      expect(within.limited).toBe(true)
      for (const other of allRooms) {
        expect(within.covers(other)).toBe(other === room)
      }
    }
  })
  test('neighbors mounts the spawn’s room and every room its fence and the fences of its parts keep enabled', () => {
    const kept: Readonly<Partial<Record<string, Activation>>> = activations
    for (const room of allRooms) {
      const within = reach(`?world_reach=neighbors&room=${room}`)
      const neighbors = new Set<string>([room, ...slopGallery.fencesIn(room).flatMap(fence => kept[fence]?.rooms ?? [])])
      expect(within.rooms).toEqual(allRooms.filter(id => neighbors.has(id)))
    }
    // The lunar hall hides Moonfall’s stairway from the Lobby, so none of Moonfall needs to load for a Lobby start.
    expect(activations.lobby.rooms).not.toContain('moonfall' as never)
    expect(reach('?world_reach=neighbors').origin).toBe('lobby')
    expect(reach('?world_reach=neighbors').covers('moonfall')).toBe(false)
    expect(reach('?world_reach=neighbors').covers('corridor')).toBe(false)
  })
  test('reaches out from where ?spawn starts, a spawn bookmark or a camera bookmark, which wins over ?room', () => {
    for (const bookmark of slopGallery.spawnBookmarks()) {
      const search = `?world_reach=room&spawn=${bookmark.id}`
      const start = slopGallery.start(`http://localhost/${search}`)
      expect(start.flying).toBe(false)
      expect(start.pose.position).toEqual(bookmark.position)
      expect(reach(search).rooms).toEqual([slopGallery.roomAt(bookmark.position)!.id])
    }
    for (const bookmark of slopGallery.cameraBookmarks()) {
      const search = `?spawn=${bookmark.id}&room=lobby`
      const start = slopGallery.start(`http://localhost/${search}`)
      expect(start.flying).toBe(true)
      expect(start.eye).toEqual(bookmark.position)
      expect(start.pose.position[0]).toBe(bookmark.position[0])
      expect(start.pose.position[2]).toBe(bookmark.position[2])
      expect(start.pose.position[1] + defaultEgoOptions.eyeHeight).toBeCloseTo(bookmark.position[1], 10)
      // The eyes decide the room even when the feet hang below its floor.
      expect(reach(`${search}&world_reach=room`).rooms).toEqual([slopGallery.roomAt(bookmark.position)!.id])
    }
  })
  test('an unknown ?room or ?spawn starts at the world’s spawn, which the reach reaches out from', () => {
    expect(slopGallery.start('http://localhost/?room=attic').unknown).toEqual({
      parameter: 'room',
      id: 'attic',
    })
    expect(slopGallery.start('http://localhost/?spawn=attic&room=oculus')).toEqual({
      pose: slopGallery.spawn,
      flying: false,
      unknown: {
        parameter: 'spawn',
        id: 'attic',
      },
    })
    expect(reach('?world_reach=room&room=attic').rooms).toEqual(['lobby'])
    expect(reach('?world_reach=room&spawn=attic&room=oculus').rooms).toEqual(['lobby'])
  })
  test('worlds of a single room have it in reach whatever the mode', () => {
    for (const world of [sandbox, knottingham]) {
      for (const mode of ['room', 'neighbors', 'all']) {
        const within = world.reachOf(`http://localhost/?world_reach=${mode}`)
        expect(within.rooms).toEqual([world.defaultRoom])
        expect(within.limited).toBe(false)
      }
    }
  })
  test('the spawn of a room in reach stands in for the world’s spawn while the default room is out of reach', () => {
    class ForgeOnlyGallery extends SlopGallery {
      override get reach() {
        return this.reachOf('http://localhost/?world_reach=room&room=forge')
      }
    }
    const gallery = new ForgeOnlyGallery
    expect(gallery.reach.covers(gallery.defaultRoom)).toBe(false)
    expect(gallery.spawnInReach).toEqual(gallery.room('forge').spawn)
    expect(slopGallery.spawnInReach).toEqual(slopGallery.spawn)
  })
})
describe('what a limited reach mounts', () => {
  test('every opening between two rooms is filled for the first of them in reach, and for none while neither is', () => {
    for (const room of allRooms) {
      const parts = roomParts(reach(`?world_reach=room&room=${room}`))
      const hosted = openingFills.filter(fill => fill.rooms.includes(room))
      expect(parts.keys().toArray()).toEqual([room])
      expect(parts.get(room)).toEqual(hosted)
    }
  })
  test('with every room in reach, each room loads and each fill comes with the room it came with before', () => {
    const parts = roomParts(reach(''))
    expect(parts.keys().toArray()).toEqual(allRooms)
    expect(parts.get('lobby')).toEqual([])
    expect(parts.get('salon')!.map(fill => fill.rooms)).toEqual([['salon', 'lobby']])
    expect(parts.get('forge')!.map(fill => fill.rooms)).toEqual([['forge', 'lobby']])
    expect(parts.get('lodge')!.map(fill => fill.rooms)).toEqual([['lodge', 'corridor'], ['lodge', 'bastion']])
    expect(parts.get('oculus')!.map(fill => fill.rooms)).toEqual([['oculus', 'bastion']])
    expect(parts.values().reduce((count, fills) => count + fills.length, 0)).toBe(openingFills.length)
  })
  test('only the rooms in reach load, each fill once', () => {
    for (const room of allRooms) {
      const within = reach(`?world_reach=neighbors&room=${room}`)
      const parts = roomParts(within)
      expect<ReadonlyArray<string>>(parts.keys().toArray()).toEqual(within.rooms)
      const fills = parts.values().toArray().flat()
      const unique = new Set(fills)
      expect(unique.size).toBe(fills.length)
      expect(unique).toEqual(new Set(openingFills.filter(fill => fill.rooms.some(id => within.covers(id)))))
    }
  })
  test('walls of rooms out of reach take no works and stop no rays, so aiming through an opening finds the void', () => {
    const lobbyOnly = placementWithin(reach('?world_reach=room'))
    expect(lobbyOnly.walls.every((wall: Wall) => wall.room === 'lobby')).toBe(true)
    expect(lobbyOnly.walls).toHaveLength(slopGallery.walls.filter(wall => wall.room === 'lobby').length)
    expect(placementWithin(reach('')).walls).toBe(slopGallery.walls)
    const arch = slopGallery.wall('lobby-west')!
    const hole = arch.holes!.find(candidate => candidate.name === 'vesper')!
    // from 3 m into the Lobby, straight through the arch into the Vesper, whose far wall only stops the ray while it is there
    const origin = wallPosition(arch, hole.u, arch.center[1] + 1.6, 3)
    const direction: Vec3 = [-Math.sin(arch.rotation), 0, -Math.cos(arch.rotation)]
    const everything = placementWithin(reach('')).findPlacement(origin, direction, 0.4, 0.4, [])
    expect(everything?.wallId.startsWith('vesper-')).toBe(true)
    expect(lobbyOnly.findPlacement(origin, direction, 0.4, 0.4, [])).toBeNull()
    expect(placementWithin(reach('?world_reach=room&room=vesper')).findPlacement(origin, direction, 0.4, 0.4, [])?.wallId).toBe(everything!.wallId)
  })
  test('works hanging on walls of rooms out of reach stay out of the scene, loose ones and those in reach stay in', () => {
    const banquetOnly = reach('?world_reach=room&room=banquet')
    const hung = {
      hung: true,
      wallId: 'banquet-east',
    }
    expect(slopGallery.portraitInReach(hung, banquetOnly)).toBe(true)
    expect(slopGallery.portraitInReach({
      ...hung,
      wallId: 'lobby-north',
    }, banquetOnly)).toBe(false)
    expect(slopGallery.portraitInReach({
      hung: false,
      wallId: 'lobby-north',
    }, banquetOnly)).toBe(true)
    expect(slopGallery.portraitInReach({hung: false}, banquetOnly)).toBe(true)
  })
})
