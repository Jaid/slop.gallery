import {expect, test} from 'bun:test'

import {salonStone, salonStoneId} from '../../src/lib/gallery/salonStone.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {createStone, stones} from '../../src/stones/index.ts'
import {readStone} from '../../src/stones/lib/forcedStone.ts'
import {stoneIds} from '../../src/stones/lib/stoneIds.ts'

test('every stone id has a material of its own, in the order of the ids', () => {
  expect(Object.keys(stones)).toEqual([...stoneIds])
  const names = new Set
  for (const id of stoneIds) {
    const material = createStone(id)
    expect(material).toBeInstanceOf(stones[id])
    expect(material).not.toBe(createStone(id))
    expect(material.name).toBeTruthy()
    names.add(material.name)
  }
  expect(names.size).toBe(stoneIds.length)
})
test('the seed rolls the Salon’s stone, with the sawn stone as the seed-zero default', () => {
  expect(stoneIds[0]).toBe('sawn')
  expect(salonStoneId(0, '')).toBe('sawn')
  expect(salonStone).toBe(salonStoneId(environmentSeed))
  const seeds = Array.from({length: 256}, (_, index) => 1 + index * 7919)
  const rolled = seeds.map(seed => salonStoneId(seed, ''))
  expect(rolled).toEqual(seeds.map(seed => salonStoneId(seed, '')))
  expect(new Set(rolled)).toEqual(new Set(stoneIds))
})
test('?stone picks any stone and ignores unknown ids', () => {
  for (const id of stoneIds) {
    const url = `http://localhost/?stone=${id}`
    expect(readStone(url)).toBe(id)
    expect(readQueryOverrides(url)).toEqual({stone: id})
    for (const seed of [0, 1, 763]) {
      expect(salonStoneId(seed, id)).toBe(id)
    }
  }
  for (const value of ['', 'unknown', 'constructor']) {
    const url = `http://localhost/?stone=${value}`
    expect(readStone(url)).toBe('')
    expect(readQueryOverrides(url)).toBeUndefined()
  }
})
