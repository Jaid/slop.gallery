const size = 2 ** 16

/** signed decimal text of an integer, of any length */
export const decimalIntegerPattern = /^(?<sign>[+-]?)(?<digits>\d+)$/u

/** The low 16 bits of an integer in two’s complement, given as a number or as signed decimal text of any length. */
export default function toUint16(integer: number | string) {
  if (typeof integer === 'number') {
    if (!Number.isInteger(integer)) {
      throw new RangeError(`Not an integer: ${integer}.`)
    }
    // The remainder of two floats is exact, so even integers beyond Number.MAX_SAFE_INTEGER keep their low bits.
    return (integer % size + size) % size
  }
  const groups = decimalIntegerPattern.exec(integer)?.groups
  if (!groups) {
    throw new RangeError(`Not a decimal integer: ${integer}.`)
  }
  let remainder = 0
  for (const digit of groups.digits) {
    remainder = (remainder * 10 + Number(digit)) % size
  }
  return groups.sign === '-' ? (size - remainder) % size : remainder
}
