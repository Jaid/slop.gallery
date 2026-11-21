import hashToUint16 from './lib/hashToUint16.ts'
import toUint16, {decimalIntegerPattern} from './lib/toUint16.ts'

/** Largest seed a roll can return, inclusive. */
export const maximumSeed = 65_536
const minimumSeed = 1
const offset = minimumSeed
const isSeed = (value: number) => Number.isInteger(value) && value >= minimumSeed && value <= maximumSeed
const rollSeed = () => {
  const data = crypto.getRandomValues(new Uint16Array(1))
  const uint16 = data[0]
  return uint16 + offset
}

/** Rolls uniformly from 1 through 65 536 without an input. A seed of that range, as a number or as its plain decimal text, stays what it is; other integers and decimal integer strings wrap into the range; other text, numbers and bytes are hashed into it. */
export default function makeSeed(input?: ArrayBuffer | Uint8Array | number | string) {
  if (input === undefined) {
    return rollSeed()
  }
  if (typeof input === 'number' && isSeed(input)) {
    return input
  }
  if (typeof input === 'string') {
    const parsed = Number(input)
    // Only the plain text of a seed, so other spellings like '+42' and '042' still wrap and '4.2e1' or ' 42' still hash.
    if (isSeed(parsed) && String(parsed) === input) {
      return parsed
    }
  }
  if (typeof input === 'number' && Number.isInteger(input) || typeof input === 'string' && decimalIntegerPattern.test(input)) {
    return toUint16(input) || maximumSeed
  }
  if (typeof input === 'number' || typeof input === 'string') {
    return hashToUint16(String(input)) + offset
  }
  if (input instanceof ArrayBuffer) {
    return hashToUint16(new Uint8Array(input)) + offset
  }
  if (input instanceof Uint8Array) {
    return hashToUint16(input) + offset
  }
  throw new TypeError('A seed input has to be a number, a string, a Uint8Array or an ArrayBuffer.')
}
