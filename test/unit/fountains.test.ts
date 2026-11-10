import type {Fountain} from '../../src/fountains/index.ts'

import {describe, expect, test} from 'bun:test'

import {fountains} from '../../src/fountains/index.ts'
import {fountainBench} from '../../src/lib/gallery/fountainBenches.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountain, lobbyFountainReach, lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const entries = Object.entries<Fountain>(fountains)
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
    expect(lobbyFountainReach).toBe(Math.max(...entries.map(([, fountain]) => fountain.radius)))
    for (const [, fountain] of entries) {
      expect(fountain.height).toBeLessThan(room.height)
      expect(lobbyFountainSpot[2] - fountain.radius).toBeGreaterThan(lobby.opening.center[1] + lobby.opening.size[1] / 2 + 1)
      expect(fountainBench.radius - fountainBench.depth / 2 - fountain.radius).toBeGreaterThan(1.3)
    }
  })
  test('one of the fountains stands in the Lobby', () => {
    expect(entries.map(([, fountain]) => fountain)).toContain(lobbyFountain)
  })
})
