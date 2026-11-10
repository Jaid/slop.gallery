import FatedRandom from 'fated-random'
import optis from 'optis'
import readPermalink from 'read-permalink'

/** the largest seed of a game state; environment randomization (which plant grows in which pot, for example) is never drawn from `Math.random()`, but rolled from the game state’s seed by {@link environmentRandom} */
export const maximumSeed = 0xFF_FF_FF_FF

/** An unsigned 32-bit integer, given as a number or as a string of decimal digits; anything else is `undefined`. */
export function parseSeed(value: unknown): number | undefined {
  const text = typeof value === 'number' ? String(value) : value
  if (typeof text !== 'string' || !/^\d{1,10}$/.test(text)) {
    return
  }
  const seed = Number(text)
  return seed <= maximumSeed ? seed : undefined
}

export const isSeed = (value: unknown): value is number => typeof value === 'number' && parseSeed(value) === value

const seedSchema = optis({
  normalizations: {
    seed: parseSeed,
  },
})

/** Reads the `?seed` override; an invalid value counts as missing. */
export function readSeedOverride(input: URL | string = typeof location === 'undefined' ? '' : location.href): number | undefined {
  return readPermalink(input, {schema: seedSchema}).seed
}

/** The `?seed` of this page, which replaces the seed of the game for this page without replacing the stored one. */
export const seedOverride = readSeedOverride()

/** A random seed for a new game state. */
export function rollSeed() {
  const [seed] = crypto.getRandomValues(new Uint32Array(1))
  return seed
}

/** The seed the environment is built from: the `?seed` override wins over the seed stored in the game state. */
export function effectiveSeed(stored: number, override = seedOverride) {
  return override ?? stored
}

/**
 * The rolls of the environment of `seed`. Whatever is rolled for gets a child of its own by its fixed ID, like `environmentRandom(seed).makeChild(['potted-plant', id])`, so its roll only depends on the seed and that ID and never on when or in which order something asks for it.
 */
export function environmentRandom(seed: number) {
  return new FatedRandom({
    id: 'slop-gallery',
    seed,
  })
}
