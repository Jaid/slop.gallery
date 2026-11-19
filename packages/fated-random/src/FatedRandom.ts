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
export type RollBooleanOptions = {
  /** how likely `true` is, from 0 for never to 1 for always, by default 0.5 */
  chance?: number
}
export type RollItemOptions<Item> = {
  /** how likely each item is compared with the others, by default all the same: a number per item in the order of the items, or a function that tells it; an item of weight 0 is never rolled */
  weights?: ((item: Item, index: number) => number) | ReadonlyArray<number>
}

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
  pick<const Item>(items: ReadonlyArray<Item>, amount = 1, options?: RollItemOptions<Item>) {
    checkAmount(items.length, amount)
    const draw = makeIndexDraw(items, options?.weights, amount)
    return withFullCopies(items, amount, take => draw(this.makeStream(), take).toSorted((a, b) => a - b).map(index => items[index]))
  }

  /** A float from 0 up to, but not including, 1. */
  roll() {
    return this.makeStream().float()
  }

  /** `true` or `false`, both as likely unless `chance` says otherwise. */
  rollBoolean(options?: RollBooleanOptions) {
    const chance = options?.chance ?? 0.5
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`A chance has to lie between 0 and 1, got ${chance}.`)
    }
    return this.roll() < chance
  }
  /** An integer from 0 to `limit`, both included; a negative limit rolls from it up to 0. */
  rollInteger(limit: number): number
  /** An integer between `from` and `to`, both included, in either order. */
  rollInteger(from: number, to: number): number
  rollInteger(from: number, to = 0) {
    const lowest = Math.min(from, to)
    const size = Math.max(from, to) - lowest + 1
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || size > 2 ** 53) {
      throw new RangeError(`Cannot roll an integer between ${from} and ${to}: both have to be safe integers at most 2 ** 53 − 1 apart.`)
    }
    return lowest + this.makeStream().below(size)
  }

  /** An integer from −`radius` to `radius`, both included. */
  rollIntegerRadius(radius: number) {
    return this.rollInteger(-radius, radius)
  }

  /** One of the items, each as likely as the others unless `weights` say otherwise. */
  rollItem<const Item>(items: ReadonlyArray<Item>, options?: RollItemOptions<Item>) {
    checkAmount(items.length, 1)
    const draw = makeItemDraw(items, options?.weights, 1)
    return draw(this.makeStream())
  }

  /** A float from −`radius` up to, but not including, `radius`. */
  rollRadius(radius: number) {
    if (!Number.isFinite(radius)) {
      throw new RangeError(`A radius has to be finite, got ${radius}.`)
    }
    const reach = Math.abs(radius)
    // Adding 0 turns the −0 of a radius of 0 into 0.
    return (this.roll() * 2 - 1) * reach + 0
  }

  /** Independent draws with replacement, in draw order. */
  sample<const Item>(items: ReadonlyArray<Item>, amount = items.length, options?: RollItemOptions<Item>) {
    checkAmount(items.length, amount)
    const draw = makeItemDraw(items, options?.weights, Math.min(amount, 1))
    const stream = this.makeStream()
    return Array.from({length: amount}, () => draw(stream))
  }

  /** Draws in random order without replacement, starting a fresh shuffle whenever the input runs out. */
  shuffle<const Item>(items: ReadonlyArray<Item>, amount = items.length, options?: RollItemOptions<Item>) {
    checkAmount(items.length, amount)
    const draw = makeIndexDraw(items, options?.weights, amount)
    const stream = this.makeStream()
    const result: Array<Item> = []
    while (result.length < amount) {
      for (const index of draw(stream, Math.min(items.length, amount - result.length))) {
        result.push(items[index])
      }
    }
    return result
  }

  /** A contiguous slice with a uniformly drawn start. Whole copies of the input precede any remaining slice. */
  slice<const Item>(items: ReadonlyArray<Item>, amount = 1) {
    checkAmount(items.length, amount)
    return withFullCopies(items, amount, take => {
      const start = this.rollInteger(items.length - take)
      return items.slice(start, start + take)
    })
  }

  /** Every roll starts its own stream at the current index. */
  private makeStream() {
    return new RollStream(this.hash.clone().absorb(this.position).finish())
  }
}
