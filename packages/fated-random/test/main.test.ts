import {expect, test} from 'bun:test'

import FatedRandom from '../src/main.ts'

const make = (seed: Uint8Array | number | string = 123) => new FatedRandom({
  id: 'slop-gallery',
  seed,
})
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
  random.shuffle(['a', 'b', 'c'], 2, {count: 5})
  random.makeChild('other').roll()
  expect(random.roll()).toBe(first)
  expect(make().roll()).toBe(first)
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
test('a count rolls in a row, starting with the single roll', () => {
  const random = make()
  const rolls = random.roll({count: 1000})
  expect(rolls).toHaveLength(1000)
  expect(rolls[0]).toBe(random.roll())
  const distinct = new Set(rolls)
  expect(distinct.size).toBe(1000)
  expect(random.roll({count: 3})).toEqual(rolls.slice(0, 3))
  expect(random.roll({count: 0})).toEqual([])
  expect(random.rollItem(['a', 'b', 'c'], {count: 5})[0]).toBe(random.rollItem(['a', 'b', 'c']))
  expect(() => random.roll({count: -1})).toThrow(RangeError)
  expect(() => random.roll({count: 1.5})).toThrow(RangeError)
})
test('rolls spread evenly over seeds, IDs, indexes and counts', () => {
  const amount = 20_000
  expectEven(Array.from({length: amount}, (_, seed) => make(seed).roll()))
  expectEven(Array.from({length: amount}, (_, id) => make().makeChild(id).roll()))
  expectEven(Array.from({length: amount}, (_, id) => make().makeChild(`spot-${id}`).roll()))
  expectEven(make().roll({count: amount}))
  const walking = make()
  expectEven(Array.from({length: amount}, () => walking.next().roll()))
})
test('neighboring seeds, IDs and indexes roll unrelated numbers', () => {
  const amount = 20_000
  const walking = make()
  for (const rolls of [
    Array.from({length: amount}, (_, seed) => make(seed).roll()),
    Array.from({length: amount}, (_, id) => make().makeChild(id).roll()),
    Array.from({length: amount}, () => walking.next().roll()),
    make().roll({count: amount}),
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
  expect(trueShare(random.rollBoolean({count: 10_000}))).toBeCloseTo(0.5, 1)
  expect(trueShare(random.rollBoolean({
    chance: 0.2,
    count: 10_000,
  }))).toBeCloseTo(0.2, 1)
  expect(trueShare(random.rollBoolean({
    chance: 0,
    count: 100,
  }))).toBe(0)
  expect(trueShare(random.rollBoolean({
    chance: 1,
    count: 100,
  }))).toBe(1)
  expect(() => random.rollBoolean({chance: 1.5})).toThrow(RangeError)
  expect(() => random.rollBoolean({chance: Number.NaN})).toThrow(RangeError)
})
test('integers include both ends, in either order, every one as likely as the others', () => {
  const random = make()
  const upTo = tally(random.rollInteger(5, {count: 12_000}))
  expect(upTo.keys().toArray().toSorted(ascending)).toEqual([0, 1, 2, 3, 4, 5])
  for (const count of upTo.values()) {
    expect(count).toBeGreaterThan(1800)
    expect(count).toBeLessThan(2200)
  }
  const between = tally(random.rollInteger(1, 10, {count: 5000}))
  expect(between.keys().toArray().toSorted(ascending)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(new Set(random.rollInteger(10, 1, {count: 5000}))).toEqual(new Set(between.keys()))
  expect(new Set(random.rollInteger(-2, {count: 500}))).toEqual(new Set([-2, -1, 0]))
  expect(random.rollInteger(7, 7)).toBe(7)
  expect(random.rollInteger(0)).toBe(0)
  expect(Number.isInteger(random.rollInteger(1, 10))).toBe(true)
  const huge = random.rollInteger(Number.MAX_SAFE_INTEGER, {count: 100})
  expect(huge.every(Number.isSafeInteger)).toBe(true)
  expect(Math.max(...huge)).toBeGreaterThan(2 ** 50)
  expect(() => random.rollInteger(1.5)).toThrow(RangeError)
  expect(() => random.rollInteger(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
  expect(() => random.rollInteger(Number.NaN)).toThrow(RangeError)
})
test('radiuses reach as far below zero as above it', () => {
  const random = make()
  const floats = random.rollRadius(2, {count: 10_000})
  expect(Math.min(...floats)).toBeGreaterThanOrEqual(-2)
  expect(Math.min(...floats)).toBeLessThan(-1.9)
  expect(Math.max(...floats)).toBeLessThan(2)
  expect(Math.max(...floats)).toBeGreaterThan(1.9)
  expect(floats.reduce((sum, roll) => sum + roll, 0) / floats.length).toBeCloseTo(0, 1)
  expect(random.rollRadius(2)).toBe(floats[0])
  expect(random.rollRadius(-2)).toBe(floats[0])
  expect(random.rollRadius(0)).toBe(0)
  expect(new Set(random.rollIntegerRadius(2, {count: 1000}))).toEqual(new Set([-2, -1, 0, 1, 2]))
  expect(random.rollIntegerRadius(0)).toBe(0)
  expect(() => random.rollRadius(Infinity)).toThrow(RangeError)
  expect(() => random.rollIntegerRadius(0.5)).toThrow(RangeError)
})
test('an item is one of the items, each as likely as the others', () => {
  const random = make().makeChild(['vesper', 'orbs'])
  const items = ['ghost', 'halloween', 'painting'] as const
  const picked: 'ghost' | 'halloween' | 'painting' = random.rollItem(['ghost', 'halloween', 'painting'])
  expect(items).toContain(picked)
  const several: Array<'ghost' | 'halloween' | 'painting'> = random.rollItem(items, {count: 4})
  expect(several).toHaveLength(4)
  expect(several[0]).toBe(picked)
  const rolls = random.rollItem(items, {count: 9000})
  for (const item of items) {
    expect(shareOf(rolls, item)).toBeCloseTo(1 / 3, 1)
  }
  expect(random.rollItem(['only'])).toBe('only')
  expect(() => random.rollItem([])).toThrow(RangeError)
})
test('weights make items as likely as their share of them', () => {
  const random = make()
  const items = ['common', 'rare', 'never'] as const
  const rolls = random.rollItem(items, {
    count: 8000,
    weights: [3, 1, 0],
  })
  expect(shareOf(rolls, 'common')).toBeCloseTo(0.75, 1)
  expect(shareOf(rolls, 'never')).toBe(0)
  const told = random.rollItem(items, {
    count: 8000,
    weights: (item, index) => (item === 'never' ? 0 : 3 - index * 2),
  })
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
  const series: Array<Array<string>> = random.shuffle(['apple', 'banana', 'cherry'], 2, {count: 5})
  expect(series).toHaveLength(5)
  for (const rolled of series) {
    expect(rolled).toHaveLength(2)
    const distinct = new Set(rolled)
    expect(distinct.size).toBe(2)
  }
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
  expect(sampled).toEqual(random.rollItem(items, {count: items.length}))
  const samples = random.sample(items, 3, {count: 100})
  expect(samples).toContainEqual(['a', 'a', 'a'])
  expect(samples).toContainEqual(['b', 'b', 'b'])
  expect(samples.flat()).toEqual(random.rollItem(items, {count: 300}))
  expect(random.sample(items, 5, {weights: [1, 0]})).toEqual(['a', 'a', 'a', 'a', 'a'])
})
test('oversized shuffles draw a fresh permutation for each pass, including the partial last one', () => {
  const random = make()
  const items = Object.freeze(['b', 'a', 'c', 'a'])
  const passes = random.shuffle(items, undefined, {count: 5})
  for (const pass of passes) {
    expect(pass.toSorted(alphabetical)).toEqual(['a', 'a', 'b', 'c'])
  }
  const orders = new Set(passes.map(pass => pass.join('')))
  expect(orders.size).toBeGreaterThan(1)
  expect(random.shuffle(items, 18)).toEqual(passes.flat().slice(0, 18))
})
test('ordered draws prepend whole copies and only randomize the remainder', () => {
  const items = Object.freeze(['c', 'a', 'd', 'b'])
  const random = make()
  for (const method of ['pick', 'slice'] as const) {
    expect(random[method](items)).toEqual([random.rollItem(items)])
    expect(random[method](items, 8)).toEqual([...items, ...items])
    for (const result of random[method](items, 10, {count: 20})) {
      expect(result.slice(0, 8)).toEqual([...items, ...items])
      const tail = result.slice(8)
      expect(tail).toHaveLength(2)
      expect(tail).toEqual(items.filter(item => tail.includes(item)))
      if (method === 'slice') {
        expect(items.indexOf(tail[1])).toBe(items.indexOf(tail[0]) + 1)
      }
    }
  }
  const pairs = random.slice(items, 2, {count: 100}).map(pair => pair.join(''))
  expect(new Set(pairs)).toEqual(new Set(['ca', 'ad', 'db']))
})
test('collection amounts, empty inputs and count have the same rules for all four methods', () => {
  const random = make()
  const items = ['a', 'b', 'c'] as const
  expect(random.sample([])).toEqual([])
  expect(random.shuffle([])).toEqual([])
  for (const method of ['sample', 'shuffle', 'pick', 'slice'] as const) {
    expect(random[method]([], 0)).toEqual([])
    expect(random[method](items, 0, {count: 2})).toEqual([[], []])
    expect(() => random[method]([], 1)).toThrow(RangeError)
    for (const amount of [-1, 0.5, Number.NaN, Infinity, 2 ** 32]) {
      expect(() => random[method](items, amount)).toThrow(RangeError)
    }
    const series: Array<Array<'a' | 'b' | 'c'>> = random[method](items, 5, {count: 3})
    expect(series).toHaveLength(3)
    expect(series[0]).toEqual(random[method](items, 5))
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
    integers: random.rollInteger(5, {count: 8}),
    item: random.rollItem(['ghost', 'halloween', 'painting'], {count: 4}),
    items: random.shuffle(['apple', 'banana', 'cherry'], 2, {count: 3}),
    radius: random.rollRadius(2),
    integerRadius: random.rollIntegerRadius(2, {count: 8}),
    next: random.next().roll(),
    bytes: rollOf({seed: new Uint8Array([1, 2, 3])}),
    bare: rollOf(),
  }).toEqual({
    roll: 0.7759796215403749,
    boolean: false,
    integer: 3,
    integers: [2, 3, 5, 1, 0, 1, 0, 4],
    item: ['painting', 'ghost', 'painting', 'halloween'],
    items: [['cherry', 'apple'], ['cherry', 'apple'], ['apple', 'cherry']],
    radius: 1.1039184861614997,
    integerRadius: [0, 1, -2, 2, 1, 2, 2, 0],
    next: 0.8376834348612097,
    bytes: 0.7665823522526701,
    bare: 0.4655171163190871,
  })
})
