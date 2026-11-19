import {randomOrbs} from '#src/orbs/index.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'
import {vesperOrbPedestals} from './vesper.ts'

/**
 * The {@link randomOrbs} in pedestal order. Each pass through the orbs is shuffled by the environment seed, except in the default environment, which uses their listed order.
 */
export function vesperOrbs(seed: number) {
  const picked = isDefaultSeed(seed) ? vesperOrbPedestals.map((_, index) => randomOrbs[index % randomOrbs.length]) : environmentRandom(seed).makeChild(['vesper', 'orbs']).shuffle(randomOrbs, vesperOrbPedestals.length)
  return picked.map((orb, index) => {
    const count = picked.slice(0, index + 1).filter(other => other === orb).length
    return {
      id: count === 1 ? orb.propId : `${orb.propId}-${count}`,
      orb,
    }
  })
}
