import {expect, test} from 'bun:test'

import {narratorCharacter, narratorTraits, narratorVoice, narratorVoices} from '../../src/lib/audio/narratorCharacter.ts'
import {effectiveSeed, environmentRandom, isSeed, maximumSeed, parseSeed, readSeedOverride, rollSeed} from '../../src/lib/environmentSeed.ts'
import {orbs, promptOrbs} from '../../src/lib/gallery/orbs/index.ts'
import {potPlacements, pottedPlantKind, pottedPlantKinds} from '../../src/lib/gallery/plantDecorations/placements.ts'

test('?seed accepts unsigned 32-bit integers and ignores anything else', () => {
  expect(readSeedOverride('?seed=1')).toBe(1)
  expect(readSeedOverride('https://slop.gallery/?graphics=fast&seed=0')).toBe(0)
  expect(readSeedOverride(`?seed=${maximumSeed}`)).toBe(maximumSeed)
  for (const value of ['', 'abc', '-1', '1.5', '1e3', String(maximumSeed + 1), ' 1']) {
    expect(readSeedOverride(`?seed=${encodeURIComponent(value)}`)).toBeUndefined()
  }
  expect(readSeedOverride('?seed')).toBeUndefined()
  expect(readSeedOverride('')).toBeUndefined()
  expect(parseSeed(7)).toBe(7)
  expect(isSeed(7)).toBe(true)
  expect(isSeed('7')).toBe(false)
  expect(isSeed(-1)).toBe(false)
})
test('an override wins over the stored seed, and rolls are random', () => {
  expect(effectiveSeed(9, 5)).toBe(5)
  expect(effectiveSeed(9, undefined)).toBe(9)
  const rolled = Array.from({length: 8}, () => rollSeed())
  expect(rolled.every(isSeed)).toBe(true)
  const distinct = new Set(rolled)
  expect(distinct.size).toBeGreaterThan(1)
})
test('the environment’s rolls depend only on the seed and the ID, never on call order', () => {
  const ids = potPlacements.map(placement => placement.id)
  const rollOf = (seed: number, id: string) => environmentRandom(seed).makeChild(id).roll()
  const forward = ids.map(id => rollOf(1, id))
  const backward = ids.toReversed().map(id => rollOf(1, id)).toReversed()
  expect(backward).toEqual(forward)
  expect(rollOf(2, ids[0])).not.toBe(rollOf(1, ids[0]))
  expect(rollOf(1, ids[0])).not.toBe(rollOf(1, ids[1]))
  expect(environmentRandom(1).seed).toBe(1)
})
for (const orb of promptOrbs) {
  test(`the ${orb.title}’s prompt names 3 to 5 of its adjectives in their order, never two synonyms, the same for the same seed`, () => {
    const pool = orb.adjectives.flat()
    const distinctPool = new Set(pool)
    expect(distinctPool.size).toBe(pool.length)
    const entryOf = (adjective: string) => orb.adjectives.findIndex(entry => (typeof entry === 'string' ? entry === adjective : entry.includes(adjective)))
    expect(orb.prompt(1)).toBe(orb.prompt(1))
    const counts = new Set<number>
    const named = new Set<string>
    for (let seed = 0; seed < 500; seed++) {
      const prompt = orb.prompt(seed)
      expect(prompt.startsWith(orb.premise)).toBe(true)
      expect(prompt.endsWith('.')).toBe(true)
      const list = prompt.slice(prompt.indexOf(orb.change) + orb.change.length + 1, -1)
      const adjectives = list.replace(` ${orb.conjunction} `, ', ').split(', ')
      const entries = adjectives.map(entryOf)
      expect(entries).not.toContain(-1)
      // strictly rising entries keep the list’s order and rule out two synonyms of the same entry
      expect(entries).toEqual(entries.toSorted((a, b) => a - b))
      const distinct = new Set(entries)
      expect(distinct.size).toBe(entries.length)
      counts.add(adjectives.length)
      for (const adjective of adjectives) {
        named.add(adjective)
      }
    }
    expect(counts).toEqual(new Set([3, 4, 5]))
    expect(named).toEqual(distinctPool)
    const prompts = new Set(Array.from({length: 50}, (_, seed) => orb.prompt(seed)))
    expect(prompts.size).toBeGreaterThan(40)
  })
}
test('the orbs’ props are told apart by their ids', () => {
  const propIds = new Set(orbs.map(orb => orb.propId))
  expect(propIds.size).toBe(orbs.length)
})
test('the narrator’s character names 2 to 5 traits in their order, never two synonyms, one noun and maybe a suffix, the same for the same seed', () => {
  const pattern = /^(?<traits>[\w-]+(?: [\w-]+)*?) (?:art gallery director|commentary|narration|narrator)(?: (?:easily hooking the listener|easy to listen to|hooking the listeners|pleasant to listen to))?$/u
  const entryOf = (trait: string) => narratorTraits.findIndex(entry => (typeof entry === 'string' ? entry === trait : entry.includes(trait)))
  expect(narratorCharacter(1)).toBe(narratorCharacter(1))
  const counts = new Set<number>
  const named = new Set<string>
  for (let seed = 0; seed < 500; seed++) {
    const groups = pattern.exec(narratorCharacter(seed))!.groups!
    const picked = groups.traits.split(' ')
    expect(picked.length).toBeGreaterThanOrEqual(2)
    expect(picked.length).toBeLessThanOrEqual(5)
    const entries = picked.map(entryOf)
    expect(entries).not.toContain(-1)
    // strictly rising entries keep the list’s order and rule out two synonyms of the same entry
    expect(entries).toEqual(entries.toSorted((a, b) => a - b))
    const distinct = new Set(entries)
    expect(distinct.size).toBe(entries.length)
    counts.add(picked.length)
    for (const trait of picked) {
      named.add(trait)
    }
  }
  expect(counts).toEqual(new Set([2, 3, 4, 5]))
  expect(named).toEqual(new Set(narratorTraits.flat()))
  const characters = new Set(Array.from({length: 50}, (_, seed) => narratorCharacter(seed)))
  expect(characters.size).toBeGreaterThan(40)
})
test('the seed picks every narrator voice, the same for the same seed', () => {
  expect(narratorVoice(1)).toBe(narratorVoice(1))
  const voices = new Set(Array.from({length: 200}, (_, seed) => narratorVoice(seed)))
  expect(voices).toEqual(new Set(narratorVoices))
})
test('every pot placement can grow every plant, and seed 1 stays put', () => {
  for (const placement of potPlacements) {
    const grown = new Set(Array.from({length: 500}, (_, seed) => pottedPlantKind(seed, placement.id)))
    expect(grown).toEqual(new Set(pottedPlantKinds))
  }
  // Captures from snap.ts and film.ts default to seed 1; a change here changes every one of them.
  expect(potPlacements.map(placement => pottedPlantKind(1, placement.id))).toEqual(['palm', 'calathea'])
})
