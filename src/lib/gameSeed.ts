import makeSeed from 'make-seed'

import {readStored, writeStored} from './browserStorage.ts'
import {effectiveSeed, parseSeed} from './environmentSeed.ts'

const storedSeed = parseSeed(readStored('seed'))

/** whether this visit continues the game of an earlier one, which stored its seed */
export const isContinuing = storedSeed !== undefined

/** the environment seed of this game: the one an earlier visit stored, or a new one, stored right away */
export const gameSeed = storedSeed ?? makeSeed()

if (!isContinuing) {
  writeStored('seed', String(gameSeed))
}

/** the seed this page’s environment is built from: the game’s, unless `?seed` overrides it */
export const environmentSeed = effectiveSeed(gameSeed)

/** how the page goes over to another seed, which {@link planSeedChange} decides and {@link applySeedChange} carries out */
export type SeedChange = {
  /** the seed this page is built from */
  previous: number
  /** the seed the next page is built from, or null where the stored seed is forgotten, so the next page rolls one for a new game */
  seed: number | null
} & ({
  /** the URL the page goes to */
  url: string
  /** `url`: the page has `?seed`, so it goes to the same URL with the seed in its place, leaving the stored seed and its game alone; `storage`: the seed is stored, or forgotten, and the page reloads */
  via: 'url'
} | {via: 'storage'})

/** How this page would go over to `seed`, or to a newly rolled one for null, without doing anything yet. */
export function planSeedChange(seed: number | null): SeedChange {
  const url = new URL(location.href)
  if (url.searchParams.has('seed')) {
    const next = seed ?? makeSeed()
    url.searchParams.set('seed', String(next))
    return {
      via: 'url',
      url: url.href,
      previous: environmentSeed,
      seed: next,
    }
  }
  return {
    via: 'storage',
    previous: environmentSeed,
    seed,
  }
}

/** Carries out a change {@link planSeedChange} decided on, which leaves this page. */
export function applySeedChange(change: SeedChange) {
  if (change.via === 'url') {
    location.assign(change.url)
    return
  }
  writeStored('seed', change.seed === null ? null : String(change.seed))
  location.reload()
}

/**
 * Builds the page from a new seed. A page with `?seed` goes to the same URL with a newly rolled `?seed`, which leaves the stored seed and its game alone. Without it, the stored seed is forgotten and the page reloads, which starts a new game in a new environment.
 */
export function rerollSeed() {
  applySeedChange(planSeedChange(null))
}
