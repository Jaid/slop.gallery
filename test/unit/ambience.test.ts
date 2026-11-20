import type {GalleryRoomId} from '../../src/worlds/gallery/SlopGallery.ts'

import {expect, test} from 'bun:test'

import AmbienceEmitter from 'ambience-emitter'

import {ambienceEmitters} from '../../src/ambience_emitters/index.ts'
import {hearingFence} from '../../src/ambience_emitters/lib/ambienceEmitters.ts'
import {fireWorldOrigin} from '../../src/lib/gallery/fireplace/config.ts'
import {audibleAmbiences} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

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
      rooms: slopGallery.ambienceFences(room, id),
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
test('the fences only hear ambiences that exist, and none of the room they lie in, which sound there anyway', () => {
  for (const {id: room} of slopGallery.rooms) {
    for (const fence of slopGallery.fencesIn(room)) {
      for (const id of audibleAmbiences(fence)) {
        const ambience = ambiences.get(id)
        expect(`${fence} hears ${ambience ? '' : 'missing '}${ambience?.room === room ? `${room}’s own ` : ''}${id}`).toBe(`${fence} hears ${id}`)
      }
    }
  }
})
test('an ambience sounds in its own room and in the fences that hear it', () => {
  expect(slopGallery.ambienceFences('moonfall', 'moonfall-orbital_sculpture').toSorted()).toEqual(['exhibition', 'moonfall'])
  expect(slopGallery.ambienceFences('lobby', 'lobby-fountain')).toEqual(['lobby'])
})
test('a listener hears an emitter in the first of the fences it is in that the emitter sounds in', () => {
  const [Emitter] = Object.values(ambienceEmitters)
  const emitter = new Emitter({
    id: 'attic-thing',
    position: [1, 2, 3],
    rooms: ['attic', 'cellar_stairs'],
  })
  expect(hearingFence(emitter, ['attic'])).toBe('attic')
  // In a part of another room it carries into, though not in that room as a whole
  expect(hearingFence(emitter, ['cellar', 'cellar_stairs'])).toBe('cellar_stairs')
  expect(emitter.strengthAt([1, 2, 3], hearingFence(emitter, ['cellar', 'cellar_stairs']))).toBe(1)
  expect(hearingFence(emitter, ['cellar', 'cellar_vault'])).toBeUndefined()
  expect(hearingFence(emitter, [])).toBeUndefined()
  // An emitter that sounds everywhere sounds in the listener’s room.
  const everywhere = new Emitter({
    id: 'cellar-thing',
    position: [0, 0, 0],
  })
  expect(hearingFence(everywhere, ['cellar', 'cellar_vault'])).toBe('cellar')
})
