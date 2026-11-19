import type {RollItemOptions} from '../FatedRandom.ts'
import type RollStream from './RollStream.ts'

type Weights<Item> = RollItemOptions<Item>['weights']

export function checkAmount(size: number, amount: number) {
  if (!Number.isInteger(amount) || amount < 0 || amount > 2 ** 32 - 1) {
    throw new RangeError(`Not a valid array length: ${amount}.`)
  }
  if (amount > 0 && !size) {
    throw new RangeError('Cannot draw items from an empty array.')
  }
}

/** Resolves weights once per call, including when several results are drawn with `count`. */
function resolveWeights<Item>(items: ReadonlyArray<Item>, weights: Weights<Item>, needed: number) {
  if (weights === undefined) {
    return
  }
  const resolved = typeof weights === 'function' ? items.map((item, index) => weights(item, index)) : [...weights]
  if (resolved.length !== items.length) {
    throw new RangeError(`Got ${resolved.length} weights for ${items.length} items.`)
  }
  if (resolved.some(weight => !(weight >= 0) || !Number.isFinite(weight))) {
    throw new RangeError('Weights have to be finite and not negative.')
  }
  if (resolved.filter(weight => weight > 0).length < needed) {
    throw new RangeError(`At least ${needed} items need a positive weight.`)
  }
  return resolved
}
const sumWeights = (weights: ReadonlyArray<number>) => weights.reduce((sum, weight) => sum + weight, 0)
/** A single draw with replacement. */
export function makeItemDraw<Item>(items: ReadonlyArray<Item>, weights: Weights<Item>, needed: number) {
  const resolved = resolveWeights(items, weights, needed)
  if (!resolved) {
    return (stream: RollStream) => items[stream.below(items.length)]
  }
  const total = sumWeights(resolved)
  return (stream: RollStream) => items[drawWeighted(stream, resolved, total)]
}

/** A fresh draw without replacement on each call. Returns indexes so a pick can restore the input order. */
export function makeIndexDraw<Item>(items: ReadonlyArray<Item>, weights: Weights<Item>, amount: number) {
  const resolved = resolveWeights(items, weights, Math.min(amount, items.length))
  return (stream: RollStream, take: number) => {
    const picked: Array<number> = []
    if (resolved) {
      const left = [...resolved]
      for (let i = 0; i < take; i++) {
        // Summed up again instead of subtracted, so that rounding never adds up.
        const index = drawWeighted(stream, left, sumWeights(left))
        picked.push(index)
        left[index] = 0
      }
    } else if (take === 1) {
      picked.push(stream.below(items.length))
    } else {
      // The start of a Fisher–Yates shuffle.
      const indexes = items.keys().toArray()
      for (let i = 0; i < take; i++) {
        const other = i + stream.below(indexes.length - i)
        picked.push(indexes[other])
        indexes[other] = indexes[i]
      }
    }
    return picked
  }
}

/** For ordered draws, only the remainder after all whole copies needs randomness. */
export function withFullCopies<Item>(items: ReadonlyArray<Item>, amount: number, draw: (take: number) => Array<Item>) {
  if (amount === 0) {
    return []
  }
  if (amount < items.length) {
    return draw(amount)
  }
  const remainder = amount % items.length
  const result = Array.from({length: amount - remainder}, (_, index) => items[index % items.length])
  if (remainder) {
    for (const item of draw(remainder)) {
      result.push(item)
    }
  }
  return result
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
