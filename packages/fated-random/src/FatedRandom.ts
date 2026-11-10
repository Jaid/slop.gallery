import IngredientHash from './lib/IngredientHash.ts'
import RollStream from './lib/RollStream.ts'

export type Arrayable<Value> = ReadonlyArray<Value> | Value
/** names what is rolled for; a number counts as its decimal text, so `7` and `'7'` name the same */
export type FatedId = number | string
/** what all rolls of a game, a world or a session share; a number counts as its decimal text, bytes never equal any text */
export type FatedSeed = Uint8Array | number | string
export type FatedRandomOptions = {
  /** the first IDs of the chain, one or several */
  id?: Arrayable<FatedId>
  seed?: FatedSeed
}
/** how often a roll rolls in a row, if at all */
export type RollCount = number | undefined
export type RollOptions<Count extends RollCount = RollCount> = {
  /** rolls that many times in a row and returns an array of the results, the first of which is the single roll’s */
  count?: Count
}
export type RollBooleanOptions<Count extends RollCount = RollCount> = RollOptions<Count> & {
  /** how likely `true` is, from 0 for never to 1 for always, by default 0.5 */
  chance?: number
}
export type RollItemOptions<Item, Count extends RollCount = RollCount> = RollOptions<Count> & {
  /** how likely each item is compared with the others, by default all the same: a number per item in the order of the items, or a function that tells it; an item of weight 0 is never rolled */
  weights?: ((item: Item, index: number) => number) | ReadonlyArray<number>
}
export type RollItemsOptions<Item, Count extends RollCount = RollCount> = RollItemOptions<Item, Count> & {
  /** returns the rolled items in the order they have among the items instead of the order they were rolled in */
  keepOrder?: boolean
}
/** what a roll returns: an array with a `count`, a single result without */
export type Rolled<Value, Count extends RollCount> = Count extends number ? Array<Value> : Value

const toArray = <Value>(value: Arrayable<Value>) => (Array.isArray(value) ? [...value as ReadonlyArray<Value>] : [value as Value])
const isId = (value: unknown): value is FatedId => typeof value === 'number' || typeof value === 'string'
/** The weight of every item, checked to be usable. */
function resolveWeights<Item>(items: ReadonlyArray<Item>, weights: NonNullable<RollItemOptions<Item>['weights']>) {
  const resolved = typeof weights === 'function' ? items.map((item, index) => weights(item, index)) : [...weights]
  if (resolved.length !== items.length) {
    throw new RangeError(`Got ${resolved.length} weights for ${items.length} items.`)
  }
  if (resolved.some(weight => !(weight >= 0) || !Number.isFinite(weight))) {
    throw new RangeError('Weights have to be finite and not negative.')
  }
  return resolved
}
/** The index of one of the weights, each as likely as its share of their `total`. */
function drawWeighted(stream: RollStream, weights: ReadonlyArray<number>, total: number) {
  let remaining = stream.float() * total
  for (const [index, weight] of weights.entries()) {
    remaining -= weight
    if (remaining < 0) {
      return index
    }
  }
  // Rounding can leave a sliver past the last weight.
  return weights.findLastIndex(weight => weight > 0)
}

/**
 * Random rolls that are decided in advance: every roll only depends on the seed, the chain of IDs and the index, never on when, how often or in which order something rolls.
 * The same roll returns the same result forever, until {@link next} moves on. What belongs to one thing gets a child of its own through {@link makeChild}, which rolls independently of every other chain.
 */
export default class FatedRandom {
  /** the chain of IDs, the given ones after those of every parent */
  readonly ids: ReadonlyArray<FatedId>
  readonly seed: FatedSeed | undefined
  private readonly hash: IngredientHash
  private position = 0

  constructor({id = [], seed}: FatedRandomOptions = {}) {
    const ids = toArray(id)
    if (!ids.every(isId)) {
      throw new TypeError('An ID has to be a number or a string.')
    }
    if (seed !== undefined && !isId(seed) && !(seed instanceof Uint8Array)) {
      throw new TypeError('A seed has to be a number, a string or a Uint8Array.')
    }
    this.ids = ids
    // A copy, so that bytes changed later leave the children with the same seed.
    this.seed = seed instanceof Uint8Array ? new Uint8Array(seed) : seed
    this.hash = new IngredientHash
    this.hash.absorb(this.seed)
    for (const part of ids) {
      this.hash.absorb(part)
    }
  }

  /** how often {@link next} moved on, 0 at first */
  get index() {
    return this.position
  }

  /**
   * Another chain of the same seed with `id` after the IDs of this one, which rolls independently of this one and of every other chain. Several IDs at once make the same child as one child after the other.
   * It starts at index 0, whatever the index of this one, so a child only depends on its IDs, never on when it was made.
   */
  makeChild(id: Arrayable<FatedId>) {
    return new FatedRandom({
      id: [...this.ids, ...toArray(id)],
      seed: this.seed,
    })
  }

  /** Moves on to the next index, which rolls everything anew. Returns itself. */
  next() {
    this.position++
    return this
  }

  /** A float from 0 up to, but not including, 1. */
  roll<Count extends RollCount = undefined>(options?: RollOptions<Count>) {
    return this.series(options, stream => stream.float())
  }

  /** `true` or `false`, both as likely unless `chance` says otherwise. */
  rollBoolean<Count extends RollCount = undefined>(options?: RollBooleanOptions<Count>) {
    const chance = options?.chance ?? 0.5
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`A chance has to lie between 0 and 1, got ${chance}.`)
    }
    return this.series(options, stream => stream.float() < chance)
  }

  /** An integer from 0 to `limit`, both included; a negative limit rolls from it up to 0. */
  rollInteger<Count extends RollCount = undefined>(limit: number, options?: RollOptions<Count>): Rolled<number, Count>
  /** An integer between `from` and `to`, both included, in either order. */
  rollInteger<Count extends RollCount = undefined>(from: number, to: number, options?: RollOptions<Count>): Rolled<number, Count>
  rollInteger(first: number, second?: RollOptions | number, third?: RollOptions): Array<number> | number {
    const [from, to, options] = typeof second === 'number' ? [first, second, third] : [0, first, second]
    const lowest = Math.min(from, to)
    const size = Math.max(from, to) - lowest + 1
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || size > 2 ** 53) {
      throw new RangeError(`Cannot roll an integer between ${from} and ${to}: both have to be safe integers at most 2 ** 53 − 1 apart.`)
    }
    return this.series(options, stream => lowest + stream.below(size))
  }

  /** An integer from −`radius` to `radius`, both included. */
  rollIntegerRadius<Count extends RollCount = undefined>(radius: number, options?: RollOptions<Count>) {
    return this.rollInteger(-radius, radius, options)
  }

  /** One of the items, each as likely as the others unless `weights` say otherwise. */
  rollItem<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, options?: RollItemOptions<Item, Count>) {
    if (!items.length) {
      throw new RangeError('Cannot roll one of no items.')
    }
    if (options?.weights === undefined) {
      return this.series(options, stream => items[stream.below(items.length)])
    }
    const weights = resolveWeights(items, options.weights)
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    if (!(total > 0)) {
      throw new RangeError('Cannot roll one of items whose weights add up to nothing.')
    }
    return this.series(options, stream => items[drawWeighted(stream, weights, total)])
  }

  /**
   * `amount` different items, in the order they were rolled in unless `keepOrder` keeps that of the items. Rolling as many as there are shuffles them.
   * With `weights`, the heavier an item, the likelier it is among them and the earlier it tends to be rolled.
   */
  rollItems<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, amount: number, options?: RollItemsOptions<Item, Count>) {
    if (!Number.isInteger(amount) || amount < 0 || amount > items.length) {
      throw new RangeError(`Cannot roll ${amount} different ones of ${items.length} items.`)
    }
    const weights = options?.weights === undefined ? undefined : resolveWeights(items, options.weights)
    if (weights && weights.filter(weight => weight > 0).length < amount) {
      throw new RangeError(`Cannot roll ${amount} different items, as fewer of them have a weight.`)
    }
    return this.series(options, stream => {
      const picked: Array<number> = []
      if (weights) {
        const left = [...weights]
        let total = left.reduce((sum, weight) => sum + weight, 0)
        while (picked.length < amount) {
          const index = drawWeighted(stream, left, total)
          picked.push(index)
          left[index] = 0
          // Summed up again instead of subtracted, so that rounding never adds up.
          total = left.reduce((sum, weight) => sum + weight, 0)
        }
      } else {
        // The start of a Fisher–Yates shuffle.
        const indexes = items.keys().toArray()
        for (let i = 0; i < amount; i++) {
          const other = i + stream.below(indexes.length - i)
          const taken = indexes[other]
          indexes[other] = indexes[i]
          picked.push(taken)
        }
      }
      if (options?.keepOrder) {
        picked.sort((a, b) => a - b)
      }
      return picked.map(index => items[index])
    })
  }

  /** A float from −`radius` up to, but not including, `radius`. */
  rollRadius<Count extends RollCount = undefined>(radius: number, options?: RollOptions<Count>) {
    if (!Number.isFinite(radius)) {
      throw new RangeError(`A radius has to be finite, got ${radius}.`)
    }
    const reach = Math.abs(radius)
    // Adding 0 turns the −0 of a radius of 0 into 0.
    return this.series(options, stream => (stream.float() * 2 - 1) * reach + 0)
  }

  /** Rolls once, or `count` times in a row from the same stream of numbers, which starts over with every call. */
  private series<Value, Count extends RollCount>(options: RollOptions<Count> | undefined, draw: (stream: RollStream) => Value) {
    const stream = new RollStream(this.hash.clone().absorb(this.position).finish())
    const count: RollCount = options?.count
    if (count === undefined) {
      return draw(stream) as Rolled<Value, Count>
    }
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`A count has to be a whole number from 0 on, got ${count}.`)
    }
    return Array.from({length: count}, () => draw(stream)) as Rolled<Value, Count>
  }
}
