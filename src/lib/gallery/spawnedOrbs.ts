import type {Orb} from '#src/orbs/index.ts'
import type {Vec3} from './types.ts'

import {create} from 'zustand'

/** an orb brought into the world from outside the game, like the ingredient a film throws, see the `spawn_orb` tool */
export type SpawnedOrb = {
  /** its prop’s id, unique in the world */
  id: string
  orb: Orb
  /** where it enters the world */
  position: Vec3
}

/** the orbs spawned into the world so far, which `SpawnedOrbs` mounts */
export const useSpawnedOrbs = create<{orbs: ReadonlyArray<SpawnedOrb>}>(() => ({orbs: []}))
