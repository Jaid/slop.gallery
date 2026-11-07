import {expect, test} from 'bun:test'

import {narratorCharacter, narratorTraits, narratorVoice, narratorVoices} from '../../src/lib/audio/narratorCharacter.ts'
import {effectiveSeed, environmentPick, environmentRoll, environmentSample, environmentWeightedPick, isSeed, maximumSeed, parseSeed, readSeedOverride, rollSeed} from '../../src/lib/environmentSeed.ts'
import {orbs, paintOrb, promptOrbs} from '../../src/lib/gallery/orbs/index.ts'
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
test('rolls depend only on seed and ID, never on call order', () => {
  const ids = potPlacements.map(placement => placement.id)
  const forward = ids.map(id => environmentRoll(1, id))
  const backward = ids.toReversed().map(id => environmentRoll(1, id)).toReversed()
  expect(backward).toEqual(forward)
  for (const roll of forward) {
    expect(roll).toBeGreaterThanOrEqual(0)
    expect(roll).toBeLessThan(1)
  }
  expect(environmentRoll(2, ids[0])).not.toBe(environmentRoll(1, ids[0]))
  expect(() => environmentPick(1, 'empty', [])).toThrow()
})
test('rolls spread evenly over seeds and over IDs', () => {
  const buckets = (rolls: Array<number>) => {
    const counts = Array.from({length: 10}, () => 0)
    for (const roll of rolls) {
      counts[Math.floor(roll * 10)]++
    }
    return counts
  }
  const bySeed = buckets(Array.from({length: 20_000}, (_, seed) => environmentRoll(seed, potPlacements[0].id)))
  const byId = buckets(Array.from({length: 20_000}, (_, index) => environmentRoll(1, `spot-${index}`)))
  for (const count of [...bySeed, ...byId]) {
    expect(count).toBeGreaterThan(1800)
    expect(count).toBeLessThan(2200)
  }
})
test('samples pick distinct items in list order, the same for the same seed and ID', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const sample = environmentSample(1, 'letters', items, 5)
  expect(sample).toHaveLength(5)
  const distinct = new Set(sample)
  expect(distinct.size).toBe(5)
  expect(sample).toEqual(items.filter(item => sample.includes(item)))
  expect(environmentSample(1, 'letters', items, 5)).toEqual(sample)
  const samples = new Set(Array.from({length: 200}, (_, seed) => environmentSample(seed, 'letters', items, 5).join('')))
  expect(samples.size).toBeGreaterThan(30)
  const picks = new Map(items.map(item => [item, 0]))
  for (let seed = 0; seed < 8000; seed++) {
    for (const item of environmentSample(seed, 'letters', items, 5)) {
      picks.set(item, picks.get(item)! + 1)
    }
  }
  // Each item lands in 5 of 8 samples.
  for (const count of picks.values()) {
    expect(count).toBeGreaterThan(4700)
    expect(count).toBeLessThan(5300)
  }
  expect(environmentSample(1, 'letters', items, 0)).toEqual([])
  expect(environmentSample(1, 'letters', items, 8)).toEqual(items)
  expect(() => environmentSample(1, 'letters', items, 9)).toThrow()
})
test('weighted picks follow their weights and depend only on seed and ID', () => {
  const counts = new Map<string, number>
  const seeds = 4000
  for (let seed = 0; seed < seeds; seed++) {
    const pick = environmentWeightedPick(seed, 'weighted', [['a', 3], ['b', 1], ['never', 0]])
    counts.set(pick, (counts.get(pick) ?? 0) + 1)
  }
  expect(counts.get('never')).toBeUndefined()
  expect(counts.get('a')! / seeds).toBeCloseTo(0.75, 1)
  expect(environmentWeightedPick(9, 'weighted', [['a', 1], ['b', 1]])).toBe(environmentWeightedPick(9, 'weighted', [['a', 1], ['b', 1]]))
  expect(() => environmentWeightedPick(1, 'empty', [])).toThrow()
  expect(() => environmentWeightedPick(1, 'weightless', [['a', 0]])).toThrow()
  expect(() => environmentWeightedPick(1, 'negative', [['a', 2], ['b', -1]])).toThrow()
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
test('the Paint Orb asks for the hung work restyled as an artistic painting of its own subject, with every trait it names', () => {
  for (let seed = 0; seed < 50; seed++) {
    const prompt = paintOrb.prompt(seed)
    expect(prompt).toStartWith(`${paintOrb.premise}\n\nPlease edit this image and restyle it while keeping the original subject intact. The output should be a beautiful high-quality artistic painting that is `)
    expect(prompt).toMatch(/^[^,]+, [^,]+(?:, [^,]+)* and [^,]+\.$/u)
    expect(prompt).not.toContain(' or ')
  }
})
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
  expect(potPlacements.map(placement => pottedPlantKind(1, placement.id))).toEqual(['jade', 'palm'])
})
