import type {RollOptions} from '../src/main.ts'

import {expect, test} from 'bun:test'

import {easing} from 'math/time'

import FatedRandom from '../src/main.ts'

const make = (seed: Uint8Array | number | string = 123) => new FatedRandom({
  id: 'slop-gallery',
  seed,
})
/** Rolls once at each index, starting at 0. */
function acrossIndexes<Value>(length: number, draw: (random: FatedRandom) => Value) {
  const random = make()
  return Array.from({length}, () => {
    const value = draw(random)
    random.next()
    return value
  })
}
/** the bare roll of a new instance */
const rollOf = (options?: ConstructorParameters<typeof FatedRandom>[0]) => {
  const random = new FatedRandom(options)
  return random.roll()
}
/** how many of `rolls`, floats from 0 to 1, fall into each of ten equal bins */
const bins = (rolls: ReadonlyArray<number>) => {
  const counts = Array.from({length: 10}, () => 0)
  for (const roll of rolls) {
    counts[Math.floor(roll * 10)]++
  }
  return counts
}
/** how much each of the numbers says about the next one, from −1 to 1 */
const correlation = (rolls: ReadonlyArray<number>) => {
  let sum = 0
  for (let i = 1; i < rolls.length; i++) {
    sum += (rolls[i - 1] - 0.5) * (rolls[i] - 0.5)
  }
  return sum / (rolls.length - 1) * 12
}
const trueShare = (rolls: ReadonlyArray<boolean>) => rolls.filter(Boolean).length / rolls.length
const shareOf = (rolls: ReadonlyArray<string>, item: string) => rolls.filter(roll => roll === item).length / rolls.length
/** how often each number was rolled */
const tally = (rolls: ReadonlyArray<number>) => {
  const result = new Map<number, number>
  for (const roll of rolls) {
    result.set(roll, (result.get(roll) ?? 0) + 1)
  }
  return result
}
const alphabetical = (a: string, b: string) => a.localeCompare(b)
const ascending = (a: number, b: number) => a - b
const expectEven = (rolls: ReadonlyArray<number>) => {
  for (const count of bins(rolls)) {
    expect(count).toBeGreaterThan(rolls.length / 10 * 0.9)
    expect(count).toBeLessThan(rolls.length / 10 * 1.1)
  }
}
test('a roll returns the same forever, whatever was rolled before and in which order', () => {
  const random = make()
  const first = random.roll()
  expect(first).toBeGreaterThanOrEqual(0)
  expect(first).toBeLessThan(1)
  expect(random.roll()).toBe(first)
  random.shuffle(['a', 'b', 'c'], 2)
  random.makeChild('other').roll()
  expect(random.roll()).toBe(first)
  expect(make().roll()).toBe(first)
})
test('easing reshapes the uniform roll at the same index', () => {
  const options: RollOptions = {easing: easing.cubicIn}
  const uniform = acrossIndexes(16, random => random.roll())
  expect(acrossIndexes(16, random => random.roll(options))).toEqual(uniform.map(easing.cubicIn))
  const random = make()
  expect(random.roll({easing: t => 1 + t})).toBe(1 + uniform[0])
  expect(random.roll({})).toBe(uniform[0])
  expect(random.index).toBe(0)
})
test('the seed, every ID and the index each decide a roll', () => {
  const rolls = new Set([
    rollOf(),
    rollOf({id: 'slop-gallery'}),
    rollOf({seed: 123}),
    make().roll(),
    make(124).roll(),
    make().next().roll(),
    make().next().next().roll(),
    make().makeChild('vesper').roll(),
    make().makeChild(['vesper', 'orbs']).roll(),
    make().makeChild(['orbs', 'vesper']).roll(),
    make().makeChild('vesperorbs').roll(),
    make().makeChild(['vespero', 'rbs']).roll(),
    make().makeChild('').roll(),
    make().makeChild(['', '']).roll(),
    // An ID is no seed and no index.
    rollOf({id: ['slop-gallery', 123]}),
    rollOf({
      id: 123,
      seed: 'slop-gallery',
    }),
    make().makeChild(1).roll(),
  ])
  expect(rolls.size).toBe(17)
})
test('several IDs at once make the same child as one child after the other', () => {
  const random = make()
  const expected = random.makeChild(['vesper', 'orbs']).roll()
  expect(random.makeChild('vesper').makeChild('orbs').roll()).toBe(expected)
  expect(rollOf({
    id: ['slop-gallery', 'vesper', 'orbs'],
    seed: 123,
  })).toBe(expected)
  expect(random.makeChild([]).roll()).toBe(random.roll())
  expect(random.makeChild(['vesper', 'orbs']).ids).toEqual(['slop-gallery', 'vesper', 'orbs'])
  expect(random.ids).toEqual(['slop-gallery'])
  expect(random.seed).toBe(123)
})
test('a child starts at index 0, whatever its parent’s index', () => {
  const random = make()
  const child = random.makeChild('vesper').roll()
  random.next()
  expect(random.index).toBe(1)
  expect(random.makeChild('vesper').index).toBe(0)
  expect(random.makeChild('vesper').roll()).toBe(child)
})
test('numbers count as their decimal text, bytes never as text', () => {
  expect(make('123').roll()).toBe(make().roll())
  expect(make().makeChild(7).roll()).toBe(make().makeChild('7').roll())
  const bytes = new Uint8Array([49, 50, 51])
  const seeded = make(bytes)
  expect(seeded.roll()).not.toBe(make('123').roll())
  expect(seeded.roll()).toBe(make(new Uint8Array([49, 50, 51])).roll())
  expect(seeded.roll()).not.toBe(make(new Uint8Array([49, 50, 52])).roll())
  // Bytes changed afterward leave the seed alone.
  const before = seeded.makeChild('a').roll()
  bytes[0] = 0
  expect(seeded.makeChild('a').roll()).toBe(before)
})
test('next moves on to rolls of their own and returns the instance', () => {
  const random = make()
  expect(random.index).toBe(0)
  const rolls = [random.roll()]
  for (let i = 1; i < 100; i++) {
    expect(random.next()).toBe(random)
    expect(random.index).toBe(i)
    rolls.push(random.roll())
  }
  const distinct = new Set(rolls)
  expect(distinct.size).toBe(100)
  const again = make()
  expect(rolls.map(() => {
    const roll = again.roll()
    again.next()
    return roll
  })).toEqual(rolls)
})
test('rolls spread evenly over seeds, IDs and indexes', () => {
  const amount = 20_000
  expectEven(Array.from({length: amount}, (_, seed) => make(seed).roll()))
  expectEven(Array.from({length: amount}, (_, id) => make().makeChild(id).roll()))
  expectEven(Array.from({length: amount}, (_, id) => make().makeChild(`spot-${id}`).roll()))
  expectEven(acrossIndexes(amount, random => random.roll()))
})
test('neighboring seeds, IDs and indexes roll unrelated numbers', () => {
  const amount = 20_000
  for (const rolls of [
    Array.from({length: amount}, (_, seed) => make(seed).roll()),
    Array.from({length: amount}, (_, id) => make().makeChild(id).roll()),
    acrossIndexes(amount, random => random.roll()),
  ]) {
    expect(Math.abs(correlation(rolls))).toBeLessThan(0.03)
  }
  // One step in the seed, the ID or the index flips about half of the bits of a roll.
  let flipped = 0
  const steps = 2000
  for (let i = 0; i < steps; i++) {
    const [a, b] = [make(i).rollInteger(2 ** 32 - 1), make(i + 1).rollInteger(2 ** 32 - 1)]
    const [c, d] = [make().makeChild(i).rollInteger(2 ** 32 - 1), make().makeChild(i + 1).rollInteger(2 ** 32 - 1)]
    for (let difference = (a ^ b) >>> 0; difference; difference >>>= 1) {
      flipped += difference & 1
    }
    for (let difference = (c ^ d) >>> 0; difference; difference >>>= 1) {
      flipped += difference & 1
    }
  }
  expect(flipped / (steps * 2 * 32)).toBeCloseTo(0.5, 1)
})
test('booleans are as likely true as false, or as likely as their chance', () => {
  const random = make()
  expect(typeof random.rollBoolean()).toBe('boolean')
  expect(trueShare(acrossIndexes(10_000, rng => rng.rollBoolean()))).toBeCloseTo(0.5, 1)
  expect(trueShare(acrossIndexes(10_000, rng => rng.rollBoolean({chance: 0.2})))).toBeCloseTo(0.2, 1)
  expect(random.rollBoolean({chance: 0})).toBe(false)
  expect(random.rollBoolean({chance: 1})).toBe(true)
  expect(() => random.rollBoolean({chance: 1.5})).toThrow(RangeError)
  expect(() => random.rollBoolean({chance: Number.NaN})).toThrow(RangeError)
})
test('chance reads percentages at the current index', () => {
  const random = make()
  for (let i = 0; i < 64; i++) {
    expect(random.chance()).toBe(random.rollBoolean())
    expect(random.chance(12.5)).toBe(random.roll() < 0.125)
    random.next()
  }
  expect(random.chance(0)).toBe(false)
  expect(random.chance(100)).toBe(true)
  for (const percentage of [-1, 101, Number.NaN]) {
    expect(() => random.chance(percentage)).toThrow(RangeError)
  }
})
test('byte draws share a stable prefix at one index and return independent arrays', () => {
  const random = make()
  const expected = new Uint8Array([162, 22, 246, 203, 32, 150, 226, 160, 109])
  for (let size = 0; size <= expected.length; size++) {
    const bytes = random.bytes({size})
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes).toEqual(expected.subarray(0, size))
    bytes.fill(0)
  }
  expect(random.bytes({size: 9})).toEqual(expected)
  expect(random.makeChild('other').bytes({size: 9})).not.toEqual(expected)
  expect(random.next().bytes({size: 9})).not.toEqual(expected)
  for (const size of [-1, 0.5, Infinity, Number.NaN]) {
    expect(() => random.bytes({size})).toThrow(RangeError)
  }
})
test('integers include both ends, in either order, every one as likely as the others', () => {
  const random = make()
  const upTo = tally(acrossIndexes(12_000, rng => rng.rollInteger(5)))
  expect(upTo.keys().toArray().toSorted(ascending)).toEqual([0, 1, 2, 3, 4, 5])
  for (const count of upTo.values()) {
    expect(count).toBeGreaterThan(1800)
    expect(count).toBeLessThan(2200)
  }
  const between = tally(acrossIndexes(5000, rng => rng.rollInteger(1, 10)))
  expect(between.keys().toArray().toSorted(ascending)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(tally(acrossIndexes(5000, rng => rng.rollInteger(10, 1)))).toEqual(between)
  expect(new Set(acrossIndexes(500, rng => rng.rollInteger(-2)))).toEqual(new Set([-2, -1, 0]))
  expect(random.rollInteger(7, 7)).toBe(7)
  expect(random.rollInteger(0)).toBe(0)
  expect(Number.isInteger(random.rollInteger(1, 10))).toBe(true)
  const huge = acrossIndexes(100, rng => rng.rollInteger(Number.MAX_SAFE_INTEGER))
  expect(huge.every(Number.isSafeInteger)).toBe(true)
  expect(Math.max(...huge)).toBeGreaterThan(2 ** 50)
  expect(() => random.rollInteger(1.5)).toThrow(RangeError)
  expect(() => random.rollInteger(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
  expect(() => random.rollInteger(Number.NaN)).toThrow(RangeError)
})
test('integer easing uses the same float in both overloads and in either bound order', () => {
  const options: RollOptions = {easing: easing.cubicIn}
  const random = make()
  for (let i = 0; i < 32; i++) {
    const expected = Math.floor(random.roll(options) * 8) - 7
    expect(random.rollInteger(-7, options)).toBe(expected)
    expect(random.rollInteger(0, -7, options)).toBe(expected)
    expect(random.rollInteger(-7, 0, options)).toBe(expected)
    expect(random.rollInteger(-7, {})).toBe(random.rollInteger(-7))
    random.next()
  }
})
test('integer easing keeps endpoints and overshoots in range', () => {
  const random = make()
  for (const [value, expected] of [[-1, 10], [0, 10], [0.25, 11], [0.75, 13], [1, 13], [2, 13]]) {
    expect(random.rollInteger(10, 13, {easing: () => value})).toBe(expected)
  }
  expect(random.rollInteger(Number.MAX_SAFE_INTEGER, {easing: () => 1})).toBe(Number.MAX_SAFE_INTEGER)
  for (const value of [Number.NaN, Infinity, -Infinity]) {
    expect(() => random.rollInteger(3, {easing: () => value})).toThrow(RangeError)
  }
})
test('radiuses reach as far below zero as above it', () => {
  const random = make()
  const floats = acrossIndexes(10_000, rng => rng.rollRadius(2))
  expect(Math.min(...floats)).toBeGreaterThanOrEqual(-2)
  expect(Math.min(...floats)).toBeLessThan(-1.9)
  expect(Math.max(...floats)).toBeLessThan(2)
  expect(Math.max(...floats)).toBeGreaterThan(1.9)
  expect(floats.reduce((sum, roll) => sum + roll, 0) / floats.length).toBeCloseTo(0, 1)
  expect(random.rollRadius(2)).toBe(floats[0])
  expect(random.rollRadius(-2)).toBe(floats[0])
  expect(random.rollRadius(0)).toBe(0)
  expect(new Set(acrossIndexes(1000, rng => rng.rollIntegerRadius(2)))).toEqual(new Set([-2, -1, 0, 1, 2]))
  expect(random.rollIntegerRadius(0)).toBe(0)
  expect(() => random.rollRadius(Infinity)).toThrow(RangeError)
  expect(() => random.rollIntegerRadius(0.5)).toThrow(RangeError)
})
test('radius easing favors the same distances on both sides of zero', () => {
  const options = {easing: easing.cubicIn}
  const offsets = acrossIndexes(4096, random => random.rollRadius(8, options))
  for (const side of [offsets.filter(value => value < 0), offsets.filter(value => value > 0)]) {
    expect(side.length / offsets.length).toBeCloseTo(0.5, 1)
    // Cubing the distance puts half of each side within one eighth of the radius.
    expect(side.filter(value => Math.abs(value) < 1).length / side.length).toBeCloseTo(0.5, 1)
  }
  const random = make()
  expect(random.rollRadius(-8, options)).toBe(offsets[0])
  expect(Math.abs(offsets[0])).toBe(random.roll(options) * 8)
  expect(random.rollRadius(0, options)).toBe(0)
  expect(random.rollRadius(8, {})).toBe(random.rollRadius(8))
  expect(random.index).toBe(0)
})
test('radius easing stays between the center and the full radius', () => {
  const random = make()
  expect(random.rollRadius(8, {easing: () => -1})).toBe(0)
  expect(Math.abs(random.rollRadius(8, {easing: () => 2}))).toBe(8)
  for (const value of [Number.NaN, Infinity, -Infinity]) {
    expect(() => random.rollRadius(8, {easing: () => value})).toThrow(RangeError)
  }
})
test('variation centers the same radius roll on the given base', () => {
  const random = make()
  const options: RollOptions = {easing: easing.cubicIn}
  for (let i = 0; i < 64; i++) {
    expect(random.vary(0.5, -2)).toBe(0.5 + random.rollRadius(2))
    expect(random.vary(0.5, -2, options)).toBe(0.5 + random.rollRadius(2, options))
    expect(random.varyInteger(-3, -2)).toBe(-3 + random.rollIntegerRadius(2))
    random.next()
  }
  expect(random.vary(0.5, 0)).toBe(0.5)
  expect(random.varyInteger(-3, 0)).toBe(-3)
  expect(() => random.varyInteger(1.5, 0.5)).toThrow(RangeError)
  expect(() => random.varyInteger(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError)
  expect(() => random.varyInteger(0, 2 ** 52)).toThrow(RangeError)
})
test('integer variation eases outward from the base on both sides', () => {
  const random = make()
  const edges = new Set<number>
  for (let i = 0; i < 32; i++) {
    expect(random.varyInteger(10, 2, {easing: () => 0})).toBe(10)
    const edge = random.varyInteger(10, -2, {easing: () => 1})
    edges.add(edge)
    expect(random.varyInteger(10, 2, {easing: () => 0.5})).toBe((10 + edge) / 2)
    random.next()
  }
  expect(edges).toEqual(new Set([8, 12]))
  const options = {easing: easing.linear}
  const rolls = tally(acrossIndexes(5000, rng => rng.varyInteger(10, 2, options)))
  for (const value of [8, 9, 10, 11, 12]) {
    expect(rolls.get(value)! / 5000).toBeCloseTo(0.2, 1)
  }
  expect(random.varyInteger(10, 0, options)).toBe(10)
  expect(() => random.varyInteger(Number.MAX_SAFE_INTEGER, 1, options)).toThrow(RangeError)
  expect(() => random.varyInteger(0, 2 ** 52, options)).toThrow(RangeError)
})
test('an item is one of the items, each as likely as the others', () => {
  const random = make().makeChild(['vesper', 'orbs'])
  const items = ['ghost', 'halloween', 'painting'] as const
  const picked: 'ghost' | 'halloween' | 'painting' = random.rollItem(['ghost', 'halloween', 'painting'])
  expect(items).toContain(picked)
  const rolls = acrossIndexes(9000, rng => rng.rollItem(items))
  for (const item of items) {
    expect(shareOf(rolls, item)).toBeCloseTo(1 / 3, 1)
  }
  expect(random.rollItem(['only'])).toBe('only')
  expect(() => random.rollItem([])).toThrow(RangeError)
})
test('weights make items as likely as their share of them', () => {
  const random = make()
  const items = ['common', 'rare', 'never'] as const
  const rolls = acrossIndexes(8000, rng => rng.rollItem(items, {weights: [3, 1, 0]}))
  expect(shareOf(rolls, 'common')).toBeCloseTo(0.75, 1)
  expect(shareOf(rolls, 'never')).toBe(0)
  const told = acrossIndexes(8000, rng => rng.rollItem(items, {weights: (item, index) => (item === 'never' ? 0 : 3 - index * 2)}))
  expect(told).toEqual(rolls)
  const single: 'common' | 'never' | 'rare' = random.rollItem(items, {weights: [0, 0, 1]})
  expect(single).toBe('never')
  expect(() => random.rollItem(items, {weights: [1, 1]})).toThrow(RangeError)
  expect(() => random.rollItem(items, {weights: [0, 0, 0]})).toThrow(RangeError)
  expect(() => random.rollItem(items, {weights: [1, -1, 1]})).toThrow(RangeError)
  expect(() => random.rollItem(items, {weights: [1, Infinity, 1]})).toThrow(RangeError)
})
test('a shuffle draws without replacement and a pick keeps the same entries in input order', () => {
  const random = make()
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const pair: Array<string> = random.shuffle(items, 2)
  expect(pair).toHaveLength(2)
  expect(pair[0]).not.toBe(pair[1])
  // As many as there are shuffle them.
  const orders = new Set<string>
  const firsts = new Map<string, number>
  for (let seed = 0; seed < 8000; seed++) {
    const shuffled = make(seed).shuffle(items)
    expect(shuffled.toSorted(alphabetical)).toEqual(items)
    orders.add(shuffled.join(''))
    firsts.set(shuffled[0], (firsts.get(shuffled[0]) ?? 0) + 1)
  }
  expect(orders.size).toBeGreaterThan(7000)
  for (const count of firsts.values()) {
    expect(count).toBeGreaterThan(850)
    expect(count).toBeLessThan(1150)
  }
  // Each item lands in 5 of 8 rolls of five.
  const picks = new Map(items.map(item => [item, 0]))
  for (let seed = 0; seed < 8000; seed++) {
    const kept = make(seed).pick(items, 5)
    expect(kept).toEqual(items.filter(item => kept.includes(item)))
    expect(kept).toEqual(make(seed).shuffle(items, 5).toSorted(alphabetical))
    for (const item of kept) {
      picks.set(item, picks.get(item)! + 1)
    }
  }
  for (const count of picks.values()) {
    expect(count).toBeGreaterThan(4700)
    expect(count).toBeLessThan(5300)
  }
})
test('sample draws with replacement, even when every draw hits the same entry', () => {
  const random = make()
  const items = ['a', 'b'] as const
  const sampled: Array<'a' | 'b'> = random.sample(items)
  expect(sampled).toHaveLength(items.length)
  expect(sampled[0]).toBe(random.rollItem(items))
  const samples = acrossIndexes(100, rng => rng.sample(items, 3))
  expect(samples).toContainEqual(['a', 'a', 'a'])
  expect(samples).toContainEqual(['b', 'b', 'b'])
  expect(random.sample(items, 5, {weights: [1, 0]})).toEqual(['a', 'a', 'a', 'a', 'a'])
})
test('oversized shuffles draw a fresh permutation for each pass, including the partial last one', () => {
  const random = make()
  const items = Object.freeze(['b', 'a', 'c', 'a'])
  const shuffled = random.shuffle(items, 18)
  expect(shuffled).toHaveLength(18)
  const orders = new Set<string>
  for (let i = 0; i < 16; i += items.length) {
    const pass = shuffled.slice(i, i + items.length)
    expect(pass.toSorted(alphabetical)).toEqual(['a', 'a', 'b', 'c'])
    orders.add(pass.join(''))
  }
  expect(orders.size).toBeGreaterThan(1)
  expect(shuffled).toEqual(random.shuffle(items, 20).slice(0, 18))
})
test('ordered draws prepend whole copies and only randomize the remainder', () => {
  const items = Object.freeze(['c', 'a', 'd', 'b'])
  const random = make()
  for (const method of ['pick', 'slice'] as const) {
    expect(random[method](items)).toEqual([random.rollItem(items)])
    expect(random[method](items, 8)).toEqual([...items, ...items])
    for (const result of acrossIndexes(20, rng => rng[method](items, 10))) {
      expect(result.slice(0, 8)).toEqual([...items, ...items])
      const tail = result.slice(8)
      expect(tail).toHaveLength(2)
      expect(tail).toEqual(items.filter(item => tail.includes(item)))
      if (method === 'slice') {
        expect(items.indexOf(tail[1])).toBe(items.indexOf(tail[0]) + 1)
      }
    }
  }
  const pairs = acrossIndexes(100, rng => rng.slice(items, 2).join(''))
  expect(new Set(pairs)).toEqual(new Set(['ca', 'ad', 'db']))
})
test('collection amounts and empty inputs have the same rules for all four methods', () => {
  const random = make()
  const items = ['a', 'b', 'c'] as const
  expect(random.sample([])).toEqual([])
  expect(random.shuffle([])).toEqual([])
  for (const method of ['sample', 'shuffle', 'pick', 'slice'] as const) {
    expect(random[method]([], 0)).toEqual([])
    expect(random[method](items, 0)).toEqual([])
    expect(() => random[method]([], 1)).toThrow(RangeError)
    for (const amount of [-1, 0.5, Number.NaN, Infinity, 2 ** 32]) {
      expect(() => random[method](items, amount)).toThrow(RangeError)
    }
    const result: Array<'a' | 'b' | 'c'> = random[method](items, 5)
    expect(result).toHaveLength(5)
    expect(result).toEqual(random[method](items, 5))
  }
})
test('several weighted items favor the heavy ones and leave out the weightless', () => {
  const items = ['heavy', 'light', 'never', 'other'] as const
  const weights = [8, 1, 0, 1]
  let heavyFirst = 0
  let heavy = 0
  const seeds = 4000
  for (let seed = 0; seed < seeds; seed++) {
    const rolled = make(seed).shuffle(items, 2, {weights})
    const distinct = new Set(rolled)
    expect(distinct.size).toBe(2)
    expect(rolled).not.toContain('never')
    heavy += Number(rolled.includes('heavy'))
    heavyFirst += Number(rolled[0] === 'heavy')
  }
  expect(heavyFirst / seeds).toBeCloseTo(0.8, 1)
  expect(heavy / seeds).toBeGreaterThan(0.95)
  expect(make().pick(items, 3, {weights})).toEqual(['heavy', 'light', 'other'])
  expect(() => make().shuffle(items, 4, {weights})).toThrow(RangeError)
  expect(() => make().pick(items, 5, {weights})).toThrow(RangeError)
})
test('anything but numbers and strings as IDs and anything but numbers, strings and bytes as seed is refused', () => {
  expect(() => new FatedRandom({id: [undefined as unknown as string]})).toThrow(TypeError)
  expect(() => new FatedRandom({id: {} as unknown as string})).toThrow(TypeError)
  expect(() => make().makeChild(null as unknown as string)).toThrow(TypeError)
  expect(() => new FatedRandom({seed: {} as unknown as string})).toThrow(TypeError)
  expect(() => new FatedRandom({seed: [1, 2] as unknown as string})).toThrow(TypeError)
})
test('rolls stay what they were, as worlds built from a seed rely on them', () => {
  const random = make().makeChild(['vesper', 'orbs'])
  expect({
    roll: random.roll(),
    boolean: random.rollBoolean(),
    integer: random.rollInteger(1, 10),
    item: random.rollItem(['ghost', 'halloween', 'painting']),
    sampled: random.sample(['ghost', 'halloween', 'painting'], 4),
    shuffled: random.shuffle(['apple', 'banana', 'cherry'], 2),
    radius: random.rollRadius(2),
    easedRadius: random.rollRadius(2, {easing: easing.cubicIn}),
    integerRadius: random.rollIntegerRadius(2),
    next: random.next().roll(),
    bytes: rollOf({seed: new Uint8Array([1, 2, 3])}),
    bare: rollOf(),
  }).toEqual({
    roll: 0.7759796215403749,
    boolean: false,
    integer: 3,
    item: 'painting',
    sampled: ['painting', 'ghost', 'painting', 'halloween'],
    shuffled: ['cherry', 'apple'],
    radius: 1.1039184861614997,
    easedRadius: 0.9345035254177151,
    integerRadius: 0,
    next: 0.8376834348612097,
    bytes: 0.7665823522526701,
    bare: 0.4655171163190871,
  })
})
