import {readStored, writeStored} from './browserStorage.ts'
import {effectiveSeed, parseSeed, rollSeed} from './environmentSeed.ts'

const storedSeed = parseSeed(readStored('seed'))

/** whether this visit continues the game of an earlier one, which stored its seed */
export const isContinuing = storedSeed !== undefined

/** the environment seed of this game: the one an earlier visit stored, or a new one, stored right away */
export const gameSeed = storedSeed ?? rollSeed()

if (!isContinuing) {
  writeStored('seed', String(gameSeed))
}

/** the seed this page’s environment is built from: the game’s, unless `?seed` overrides it */
export const environmentSeed = effectiveSeed(gameSeed)

/**
 * Builds the page from a new seed. A page with `?seed` goes to the same URL with a newly rolled `?seed`, which leaves the stored seed and its game alone. Without it, the stored seed is forgotten and the page reloads, which starts a new game in a new environment.
 */
export function rerollSeed() {
  const url = new URL(location.href)
  if (url.searchParams.has('seed')) {
    url.searchParams.set('seed', String(rollSeed()))
    location.assign(url)
    return
  }
  writeStored('seed', null)
  location.reload()
}
