import FatedRandom from 'fated-random'
import optis from 'optis'
import readPermalink from 'read-permalink'
import rollSeed, {maximumSeed} from 'roll-seed'

/** A canonical game seed: a roll of `roll-seed`, or 0 for the default environment. */
export const isSeed = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximumSeed

/** Reads a canonical game seed, as stored or used as a numeric range bound. */
export function parseSeed(value: unknown): number | undefined {
  const seed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value
  return isSeed(seed) ? seed : undefined
}

/** A supplied seed may also name a world with text or a number outside the roll range. A missing or bare flag keeps the stored seed. */
export function coerceEnvironmentSeed(value: unknown): number | undefined {
  if (typeof value === 'number' || typeof value === 'string' && value !== '') {
    return parseSeed(value) ?? rollSeed(value)
  }
}

const seedSchema = optis({
  normalizations: {
    seed: coerceEnvironmentSeed,
  },
})

/** Reads the `?seed` override. */
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

/** The seed the environment is built from: the `?seed` override wins over the seed stored in the game state. */
export function effectiveSeed(stored: number, override = seedOverride) {
  return override ?? stored
}

/**
 * The rolls of the environment of `seed`. Whatever is rolled for gets a child of its own by its fixed ID, like `environmentRandom(seed).makeChild(['work-frame', work])`, so its roll only depends on the seed and that ID and never on when or in which order something asks for it.
 */
export function environmentRandom(seed: number) {
  return new FatedRandom({
    id: 'slop-gallery',
    seed,
  })
}
