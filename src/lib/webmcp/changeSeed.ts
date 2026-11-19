import type {SeedChange} from '#src/lib/gameSeed.ts'

import {applySeedChange, planSeedChange} from '#src/lib/gameSeed.ts'

export type SeedInput = {
  /** the seed to build the next page from, an unsigned 32-bit integer */
  seed: number
}

/** Goes over to `seed`, or to a newly rolled one for null, the way Reroll seed does; see the `reroll_seed` and `set_seed` tools. It answers with the change first and leaves the page a task later, so the answer still reaches the caller. */
export default function changeSeed(seed: number | null): SeedChange {
  const change = planSeedChange(seed)
  setTimeout(() => applySeedChange(change))
  return change
}
