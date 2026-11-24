const warmupRounds = 15
const mantissa = 2 ** 53

/**
 * The numbers one roll draws, as many as it needs: Chris Doty-Humphrey’s sfc32, which passes PractRand, started from 128 bits of state.
 */
export default class RollStream {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor([a, b, c, d]: readonly [number, number, number, number]) {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    for (let i = 0; i < warmupRounds; i++) {
      this.word()
    }
  }

  /** An integer from 0 up to, but not including, `size`, every one as likely as the others; `size` may be anything from 1 to 2 ** 53. */
  below(size: number) {
    // Whatever lies past the last whole multiple of the size would favor the lowest results.
    const limit = mantissa - mantissa % size
    let drawn = this.integer()
    while (drawn >= limit) {
      drawn = this.integer()
    }
    return drawn % size
  }

  /** A fresh draw with the given probability of being true. */
  boolean(chance = 0.5) {
    return this.float() < chance
  }

  /** An eased draw clamped to [0, 1] for mapping to a bounded range. */
  boundedFloat(easing: (t: number) => number) {
    const eased = easing(this.float())
    if (!Number.isFinite(eased)) {
      throw new RangeError(`A bounded roll’s easing curve has to return a finite number, got ${eased}.`)
    }
    return Math.min(1, Math.max(0, eased))
  }

  /** Draws four bytes per word, least significant byte first on every platform. */
  bytes(size: number) {
    const bytes = new Uint8Array(size)
    let word = 0
    for (let i = 0; i < size; i++) {
      if (i % 4 === 0) {
        word = this.word()
      }
      bytes[i] = word & 0xFF
      word >>>= 8
    }
    return bytes
  }

  /** A float from 0 up to, but not including, 1, with all 53 bits a float holds between them. */
  float() {
    return this.integer() / mantissa
  }

  /** An integer from 0 up to, but not including, 2 ** 53. */
  private integer() {
    const high = this.word() >>> 5
    const low = this.word() >>> 6
    return high * 2 ** 26 + low
  }

  /** The next unsigned 32-bit integer. */
  private word() {
    const sum = this.a + this.b + this.d >>> 0
    this.d = this.d + 1 >>> 0
    this.a = (this.b ^ this.b >>> 9) >>> 0
    this.b = this.c + (this.c << 3) >>> 0
    this.c = (this.c << 21 | this.c >>> 11) + sum >>> 0
    return sum
  }
}
