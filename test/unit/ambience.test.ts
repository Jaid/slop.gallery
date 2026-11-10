import type {GalleryRoomId} from '../../src/worlds/gallery/SlopGallery.ts'

import {expect, test} from 'bun:test'

import AmbienceEmitter from 'ambience-emitter'

import {ambienceEmitters} from '../../src/ambience_emitters/index.ts'
import {fireWorldOrigin} from '../../src/lib/gallery/fireplace/config.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations, {audibleAmbiences} from '../../src/worlds/gallery/relations.ts'

const ambiences = new Map(slopGallery.ambiences().map(ambience => [ambience.id, ambience]))
test('every kind of ambience emitter sounds wherever it is placed, under the id and in the rooms it is given', () => {
  for (const Emitter of Object.values(ambienceEmitters)) {
    const emitter = new Emitter({
      id: 'attic-thing',
      position: [1, 2, 3],
      rooms: ['attic'],
    })
    expect(emitter).toBeInstanceOf(AmbienceEmitter)
    expect(emitter.id).toBe('attic-thing')
    expect(emitter.position).toEqual([1, 2, 3])
    expect(emitter.title).toBeTruthy()
    expect(emitter.isInside('attic')).toBe(true)
    expect(emitter.isInside('cellar')).toBe(false)
    expect(emitter.playing).toBe(false)
    // Placed twice, they are two emitters.
    const other = new Emitter({
      id: 'cellar-thing',
      position: [0, 0, 0],
    })
    expect(other.id).toBe('cellar-thing')
  }
})
test('the rooms name the kinds of their ambient sounds, which the world places under their global ids', () => {
  expect(ambiences.size).toBeGreaterThan(0)
  for (const [id, {emitter, position, room}] of ambiences) {
    expect(Object.keys(ambienceEmitters)).toContain(emitter)
    expect(id.startsWith(`${room}-`)).toBe(true)
    const within = id.slice(room.length + 1)
    const placement = slopGallery.ambience(room as GalleryRoomId, within)
    expect(placement).toEqual({
      emitter,
      id,
      position,
      rooms: slopGallery.ambienceRooms(room, id),
    })
    expect(slopGallery.roomAt(position)?.id).toBe(room as GalleryRoomId)
  }
  expect(() => slopGallery.ambience('lobby', 'kettle')).toThrow('lobby-kettle')
  // The Lodge’s fire sounds from just above its logs.
  const fire = ambiences.get('lodge-fire')!.position
  expect(fire[0]).toBeCloseTo(fireWorldOrigin[0], 9)
  expect(fire[1]).toBeCloseTo(fireWorldOrigin[1] + 0.6, 9)
  expect(fire[2]).toBeCloseTo(fireWorldOrigin[2], 9)
})
test('the rooms only hear ambiences that exist, and none of their own', () => {
  for (const room of Object.keys(relations) as Array<GalleryRoomId>) {
    for (const id of audibleAmbiences(room)) {
      const ambience = ambiences.get(id)
      expect(`${room} hears ${ambience ? '' : 'missing '}${ambience?.room === room ? 'its own ' : ''}${id}`).toBe(`${room} hears ${id}`)
    }
  }
})
test('an ambience sounds in its own room and in the rooms that hear it', () => {
  expect(slopGallery.ambienceRooms('moonfall', 'moonfall-orbital_sculpture').toSorted()).toEqual(['exhibition', 'moonfall'])
  expect(slopGallery.ambienceRooms('lobby', 'lobby-fountain')).toEqual(['lobby'])
})
