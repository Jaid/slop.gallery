import FatedRandom from 'fated-random'
import optis from 'optis'
import readPermalink from 'read-permalink'

/** the largest seed of a game state, which `?seed` may ask for even though new games only roll {@link rolledSeeds}; environment randomization (which plant grows in which pot, for example) is never drawn from `Math.random()`, but rolled from the game state’s seed by {@link environmentRandom} */
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

/** the seed of the default environment, `?seed=0`: whatever has a default of its own takes it instead of rolling for it, like the Lobby’s first fountain, every room’s first frame and the random orbs in their order on the Vesper’s pedestals */
export const defaultSeed = 0

/** Whether `seed` asks for the default environment, which skips the rolls that have a default. */
export function isDefaultSeed(seed: number) {
  return seed === defaultSeed
}

/** the seeds a new game state rolls from, both inclusive: short enough to read out, and never {@link defaultSeed}, which only `?seed=0` asks for */
export const rolledSeeds = {
  minimum: 1,
  maximum: 9999,
} as const

/** A random seed for a new game state, any of {@link rolledSeeds} equally likely. */
export function rollSeed() {
  const {minimum, maximum} = rolledSeeds
  const span = maximum - minimum + 1
  // Draws from the top beyond the last whole span would favor the lower seeds, so they are drawn again.
  const limit = Math.floor(2 ** 32 / span) * span
  const values = new Uint32Array(1)
  do {
    crypto.getRandomValues(values)
  } while (values[0] >= limit)
  return minimum + values[0] % span
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
