import type {Fountain, FountainId} from '../../src/fountains/index.ts'

import {describe, expect, test} from 'bun:test'

import {createFountain, fountains} from '../../src/fountains/index.ts'
import {readFountain} from '../../src/fountains/lib/forcedFountain.ts'
import {fountainBench} from '../../src/lib/gallery/fountainBenches.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountain, lobbyFountainId, lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const entries = (Object.keys(fountains) as Array<FountainId>).map((id): [FountainId, Fountain] => [id, createFountain(id)])
describe('fountains', () => {
  test('every fountain goes by its id and tells its size without being built', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const [id, fountain] of entries) {
      expect(fountain.id).toBe(id)
      expect(fountain.constructor.name.toLowerCase()).toBe(`${id}fountain`)
      expect(fountain.title).toBeTruthy()
      expect(fountain.description).toBeTruthy()
      expect(fountain.radius).toBeGreaterThan(0)
      // Its water sounds from on its axis, where its tallest jet leaves it, below where that jet turns back.
      expect(fountain.mouth[0]).toBe(0)
      expect(fountain.mouth[2]).toBe(0)
      expect(fountain.mouth[1]).toBeGreaterThan(0)
      expect(fountain.height).toBeGreaterThan(fountain.mouth[1])
    }
  })
  test('every fountain loads a model of its own', async () => {
    const models = await Promise.all(entries.map(([, fountain]) => fountain.loadModel()))
    for (const model of models) {
      expect(model).toBeFunction()
    }
    const distinct = new Set(models)
    expect(distinct.size).toBe(models.length)
  })
})
describe('the Lobby’s fountain', () => {
  test('any fountain fits where the Lobby stands its own: under the vault’s spring, clear of the glass floor and with a walkway left to its benches', () => {
    const room = slopGallery.room('lobby')
    expect(lobbyFountainSpot[0]).toBe(0)
    expect(room.room.fence.contains(room.toLocal(lobbyFountainSpot))).toBe(true)
    for (const [, fountain] of entries) {
      expect(fountain.height).toBeLessThan(room.height)
      expect(lobbyFountainSpot[2] - fountain.radius).toBeGreaterThan(lobby.opening.center[1] + lobby.opening.size[1] / 2 + 1)
      expect(fountainBench.radius - fountainBench.depth / 2 - fountain.radius).toBeGreaterThan(1.3)
    }
  })
  test('every seed rolls the fountain that stands in the Lobby, the same one every time, and between them the seeds roll every fountain', () => {
    const seeds = Array.from({length: 64}, (_, index) => index * 7919 + 1)
    const rolled = seeds.map<string>(seed => lobbyFountainId(seed, ''))
    expect(rolled).toEqual(seeds.map(seed => lobbyFountainId(seed, '')))
    const distinct = new Set(rolled)
    expect([...distinct].toSorted()).toEqual(Object.keys(fountains).toSorted())
    // Fairly, give or take.
    for (const [id] of entries) {
      expect(rolled.filter(roll => roll === id).length).toBeGreaterThan(seeds.length / entries.length / 2)
    }
  })
  test('seed 0 stands the first fountain there is, the marble one, unless ?fountain asks for another', () => {
    expect(Object.keys(fountains)[0]).toBe('marble')
    expect(lobbyFountainId(0, '')).toBe('marble')
    for (const id of Object.keys(fountains) as Array<FountainId>) {
      expect(lobbyFountainId(0, id)).toBe(id)
    }
  })
  test('the game builds only the fountain its seed rolled, and the intro keeps that one in focus', () => {
    expect(lobbyFountain).toBeInstanceOf(fountains[lobbyFountainId(environmentSeed)])
    expect(lobbyFountain.id).toBe(lobbyFountainId(environmentSeed))
    expect(slopGallery.introOrbit.subject).toBe(lobbyFountain.radius)
  })
  test('?fountain stands one of them in the Lobby whatever the seed rolls, and ignores anything else', () => {
    for (const id of Object.keys(fountains) as Array<FountainId>) {
      expect(readFountain(`http://localhost/?fountain=${id}`)).toBe(id)
      for (const seed of [1, 2, 3, 4]) {
        expect(lobbyFountainId(seed, id)).toBe(id)
      }
    }
    expect(readFountain('http://localhost/?fountain=trevi')).toBe('')
    expect(readFountain('http://localhost/?fountain=toString')).toBe('')
    expect(readFountain('http://localhost/')).toBe('')
  })
})
