export type Ingredient = Uint8Array | number | string | undefined

const absentTag = 0
const textTag = 1
const bytesTag = 2

/**
 * A 128-bit hash of a list of ingredients, in which every bit of every ingredient decides about half of the result’s bits.
 * Every ingredient is framed by its kind and its length, so `['ab', 'c']` and `['a', 'bc']` never meet, and a number counts as its decimal text, so `7` and `'7'` do.
 * The mixing is bryc’s cyrb128, fed 32-bit units instead of UTF-16 code units.
 */
export default class IngredientHash {
  private h1 = 1_779_033_703
  private h2 = 3_144_134_277
  private h3 = 1_013_904_242
  private h4 = 2_773_480_762

  /** Adds an ingredient after the ones before it. */
  absorb(ingredient: Ingredient) {
    if (ingredient === undefined) {
      this.mix(absentTag)
      return this
    }
    if (ingredient instanceof Uint8Array) {
      this.mix(bytesTag)
      this.mix(ingredient.length)
      for (const byte of ingredient) {
        this.mix(byte)
      }
      return this
    }
    const text = String(ingredient)
    this.mix(textTag)
    this.mix(text.length)
    for (const character of text) {
      this.mix(character.codePointAt(0)!)
    }
    return this
  }

  /** A copy to add other ingredients to, which leaves this one as it is. */
  clone() {
    const copy = new IngredientHash
    copy.h1 = this.h1
    copy.h2 = this.h2
    copy.h3 = this.h3
    copy.h4 = this.h4
    return copy
  }

  /** The hash of the ingredients so far as four unsigned 32-bit integers, which leaves this one as it is. */
  finish(): [number, number, number, number] {
    let {h1, h2, h3, h4} = this
    h1 = Math.imul(h3 ^ h1 >>> 18, 597_399_067)
    h2 = Math.imul(h4 ^ h2 >>> 22, 2_869_860_233)
    h3 = Math.imul(h1 ^ h3 >>> 17, 951_274_213)
    h4 = Math.imul(h2 ^ h4 >>> 19, 2_716_044_179)
    h1 ^= h2 ^ h3 ^ h4
    return [h1 >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
  }

  private mix(unit: number) {
    this.h1 = this.h2 ^ Math.imul(this.h1 ^ unit, 597_399_067)
    this.h2 = this.h3 ^ Math.imul(this.h2 ^ unit, 2_869_860_233)
    this.h3 = this.h4 ^ Math.imul(this.h3 ^ unit, 951_274_213)
    this.h4 = this.h1 ^ Math.imul(this.h4 ^ unit, 2_716_044_179)
  }
}
