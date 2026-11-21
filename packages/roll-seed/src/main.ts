import type {FatedSeed} from 'fated-random'

import FatedRandom from 'fated-random'

/** Largest seed a roll can return, inclusive. */
export const maximumSeed = 65_536

/** Rolls uniformly from 1 through 65 536 without an input. Integers and decimal integer strings wrap into that range; other inputs seed a deterministic roll. */
export default function rollSeed(input?: ArrayBuffer | FatedSeed): number {
  if (input === undefined) {
    const data = crypto.getRandomValues(new Uint16Array(1))
    const uint16 = data[0]
    return uint16 + 1
  }
  if (typeof input === 'number' && Number.isInteger(input) || typeof input === 'string' && /^[+-]?\d+$/u.test(input)) {
    // Parse decimal text directly so even integers beyond Number.MAX_SAFE_INTEGER keep their low bits.
    return Number(BigInt.asUintN(16, BigInt(input))) || maximumSeed
  }
  const random = new FatedRandom({seed: input instanceof ArrayBuffer ? new Uint8Array(input) : input})
  return random.rollInteger(1, maximumSeed)
}
