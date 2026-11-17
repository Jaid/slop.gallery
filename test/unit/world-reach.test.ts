import {describe, expect, test} from 'bun:test'

import {resolveGallerySetup} from '../../scripts/lib/headlessGallery.ts'
import readQueryOverrides, {queryParameters} from '../../src/lib/queryOverrides.ts'
import {readWorldReach, roomsWithinReach, worldReaches} from '../../src/lib/worldReach.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations from '../../src/worlds/gallery/relations.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

describe('?world_reach', () => {
  test('reads room, neighbors and all, and defaults to all for anything else', () => {
    expect(worldReaches).toEqual(['room', 'neighbors', 'all'])
    expect(readWorldReach('?world_reach=room')).toBe('room')
    expect(readWorldReach('?world_reach=neighbors')).toBe('neighbors')
    expect(readWorldReach('?world_reach=all')).toBe('all')
    expect(readWorldReach('https://slop.gallery/?seed=1&world_reach=neighbors&room=bastion')).toBe('neighbors')
    for (const search of ['', '?world_reach', '?world_reach=', '?world_reach=ROOM', '?world_reach=neighbour', '?world_reach=none', '?reach=room']) {
      expect(readWorldReach(search)).toBe('all')
    }
  })
  test('shows among the query overrides only where it limits the world', () => {
    expect(queryParameters).toContain('world_reach')
    expect(readQueryOverrides('http://localhost/?world_reach=room')).toEqual({world_reach: 'room'})
    expect(readQueryOverrides('http://localhost/?world_reach=neighbors')).toEqual({world_reach: 'neighbors'})
    expect(readQueryOverrides('http://localhost/?world_reach=all')).toBeUndefined()
    expect(readQueryOverrides('http://localhost/?world_reach=bogus')).toBeUndefined()
  })
  test('the gallery names every room’s relations as its neighbors, and no others', () => {
    for (const room of slopGallery.rooms) {
      expect(slopGallery.neighborRooms(room.id)).toEqual(relations[room.id].rooms)
      expect(slopGallery.neighborRooms(room.id)).not.toContain(room.id)
    }
    expect(slopGallery.neighborRooms('nowhere')).toEqual([])
    expect(sandbox.neighborRooms('cell')).toEqual([])
    expect(knottingham.neighborRooms('arena')).toEqual([])
  })
  test('room loads only the spawn position’s room', () => {
    for (const room of slopGallery.rooms) {
      expect(roomsWithinReach('room', slopGallery, room.spawn.position)).toEqual(new Set([room.id]))
    }
    expect(roomsWithinReach('room', sandbox, sandbox.spawn.position)).toEqual(new Set(['cell']))
    expect(roomsWithinReach('room', knottingham, knottingham.spawn.position)).toEqual(new Set(['arena']))
  })
  test('neighbors loads the spawn room and the rooms its relations list, no further', () => {
    const bastion = slopGallery.room('bastion')
    expect(roomsWithinReach('neighbors', slopGallery, bastion.spawn.position)).toEqual(new Set(['bastion', ...relations.bastion.rooms]))
    const sienna = roomsWithinReach('neighbors', slopGallery, slopGallery.room('sienna').spawn.position)!
    expect(sienna).toEqual(new Set(['sienna', 'vesper', 'corridor', 'lobby', 'salon']))
    // The Lobby sees far, but not into the Lodge or the Corridor, which load with neither reach.
    const lobby = roomsWithinReach('neighbors', slopGallery, slopGallery.spawn.position)!
    expect(lobby.has('lodge')).toBe(false)
    expect(lobby.has('corridor')).toBe(false)
    expect(roomsWithinReach('neighbors', sandbox, sandbox.spawn.position)).toEqual(new Set(['cell']))
    expect(roomsWithinReach('neighbors', knottingham, knottingham.spawn.position)).toEqual(new Set(['arena']))
  })
  test('all, and a spawn outside of every room, limit nothing', () => {
    expect(roomsWithinReach('all', slopGallery, slopGallery.spawn.position)).toBeNull()
    for (const reach of worldReaches) {
      expect(roomsWithinReach(reach, slopGallery, [1000, 0, 1000])).toBeNull()
    }
  })
  test('every spawn and camera bookmark of the gallery stands in a room to limit the loading to', () => {
    const positions = [
      slopGallery.spawn.position,
      ...slopGallery.spawnBookmarks().map(bookmark => bookmark.position),
      ...slopGallery.cameraBookmarks().map(bookmark => bookmark.position),
    ]
    for (const position of positions) {
      expect(roomsWithinReach('room', slopGallery, position)?.size).toBe(1)
    }
  })
  test('the headless scripts pass a valid --world_reach to the page and reject any other', async () => {
    const setup = await resolveGallerySetup({
      graphics: 'fast',
      seed: '1',
      room: 'bastion',
      world_reach: 'neighbors',
    })
    expect(setup.search.get('world_reach')).toBe('neighbors')
    let thrown: unknown
    try {
      await resolveGallerySetup({
        graphics: 'fast',
        seed: '1',
        world_reach: 'nearby',
      })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('--world_reach must be one of room, neighbors, all, got “nearby”.')
  })
})
