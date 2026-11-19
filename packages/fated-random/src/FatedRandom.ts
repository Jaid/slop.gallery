import IngredientHash from './lib/IngredientHash.ts'
import {checkAmount, makeIndexDraw, makeItemDraw, withFullCopies} from './lib/itemDraws.ts'
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
/** what a roll returns: an array with a `count`, a single result without */
export type Rolled<Value, Count extends RollCount> = Count extends number ? Array<Value> : Value

const toArray = <Value>(value: Arrayable<Value>) => (Array.isArray(value) ? [...value as ReadonlyArray<Value>] : [value as Value])
const isId = (value: unknown): value is FatedId => typeof value === 'number' || typeof value === 'string'

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

  /** A random subset in input order. Whole copies of the input precede any remaining picks. */
  pick<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, amount = 1, options?: RollItemOptions<Item, Count>) {
    checkAmount(items.length, amount)
    const draw = makeIndexDraw(items, options?.weights, amount)
    return this.series(options, stream => withFullCopies(items, amount, take => draw(stream, take).toSorted((a, b) => a - b).map(index => items[index])))
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
    checkAmount(items.length, 1)
    return this.series(options, makeItemDraw(items, options?.weights, 1))
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

  /** Independent draws with replacement, in draw order. */
  sample<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, amount = items.length, options?: RollItemOptions<Item, Count>) {
    checkAmount(items.length, amount)
    const draw = makeItemDraw(items, options?.weights, Math.min(amount, 1))
    return this.series(options, stream => Array.from({length: amount}, () => draw(stream)))
  }

  /** Draws in random order without replacement, starting a fresh shuffle whenever the input runs out. */
  shuffle<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, amount = items.length, options?: RollItemOptions<Item, Count>) {
    checkAmount(items.length, amount)
    const draw = makeIndexDraw(items, options?.weights, amount)
    return this.series(options, stream => {
      const result: Array<Item> = []
      while (result.length < amount) {
        for (const index of draw(stream, Math.min(items.length, amount - result.length))) {
          result.push(items[index])
        }
      }
      return result
    })
  }

  /** A contiguous slice with a uniformly drawn start. Whole copies of the input precede any remaining slice. */
  slice<const Item, Count extends RollCount = undefined>(items: ReadonlyArray<Item>, amount = 1, options?: RollOptions<Count>) {
    checkAmount(items.length, amount)
    return this.series(options, stream => withFullCopies(items, amount, take => {
      const start = stream.below(items.length - take + 1)
      return items.slice(start, start + take)
    }))
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
