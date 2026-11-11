import type {Orb} from '#src/orbs/index.ts'

import {halloweenOrb, horrorOrb, paintOrb, spookOrb} from '#src/orbs/index.ts'

/** the props that, lying in the Forge or carried into it, steer the flavor the alchemy machine gives a Transparent Orb to an orb of their own, by their ids: the pumpkin to the Halloween Orb, the hatchet to the Horror Orb, the helmet to the Spook Orb and the Painting Set to the Paint Orb */
export const flavorSteering: ReadonlyMap<string, Orb> = new Map<string, Orb>([
  ['prop-pumpkin', halloweenOrb],
  ['prop-hatchet', horrorOrb],
  ['prop-helmet', spookOrb],
  ['prop-painting-set', paintOrb],
])

/** the orb the prop steers the flavor to, if any: by its id, or the id of the first of its kind it is numbered after, like `prop-pumpkin-2` */
export function steeredOrb(id: string) {
  const kind = /^(?<kind>.+?)(?:-\d+)?$/.exec(id)!.groups!.kind
  return flavorSteering.get(kind)
}
