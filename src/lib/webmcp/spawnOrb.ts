import type {Vec3} from '#src/lib/gallery/types.ts'

import {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import {useSpawnedOrbs} from '#src/lib/gallery/spawnedOrbs.ts'

/** how long a spawned orb may take to enter the world, in milliseconds */
const mountTimeout = 20_000
export type OrbSpawnInput = {
  /** its prop’s id; by default the orb’s own prop id, numbered like `prop-orb-horror-spawned-1` */
  id?: string
  /** the id of the kind of orb, like `horror` */
  orb: string
  /** where it enters the world, in world meters */
  position: Vec3
}
export type OrbSpawn = {
  orb: string
  position: Vec3
  prop: string
}

let spawned = 0

/** Brings an orb of the kind `orb` into the world at `position`, lying there like any other, and resolves once its prop is in the world; see the `spawn_orb` tool. */
export default async function spawnOrb({id, orb, position}: OrbSpawnInput): Promise<OrbSpawn> {
  const {orbs} = await import('#src/lib/gallery/orbs/index.ts')
  const kind = orbs.find(candidate => candidate.id === orb)
  if (!kind) {
    throw new Error(`There is no orb “${orb}”. Orbs: ${orbs.map(candidate => candidate.id).join(', ')}.`)
  }
  const prop = id ?? `${kind.propId}-spawned-${++spawned}`
  if (propObjects.has(prop) || useSpawnedOrbs.getState().orbs.some(candidate => candidate.id === prop)) {
    throw new Error(`There already is a prop “${prop}” in the world.`)
  }
  useSpawnedOrbs.setState(({orbs: current}) => ({
    orbs: [...current, {
      id: prop,
      orb: kind,
      position,
    }],
  }))
  // React mounts it and the physics builds its body without an animation frame, so this also resolves under a stopped virtual clock.
  const deadline = Date.now() + mountTimeout
  while (!propObjects.has(prop)) {
    if (Date.now() > deadline) {
      throw new Error(`“${prop}” did not enter the world within ${mountTimeout / 1000} s.`)
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  return {
    prop,
    orb: kind.id,
    position,
  }
}
