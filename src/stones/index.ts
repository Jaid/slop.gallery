import type {StoneId} from './lib/stoneIds.ts'
import type {Material} from 'three/webgpu'

import LarvikiteStoneMaterial from './larvikite/LarvikiteStoneMaterial.ts'
import PorphyryStoneMaterial from './porphyry/PorphyryStoneMaterial.ts'
import SawnStoneMaterial from './sawn/SawnStoneMaterial.ts'
import StatuarioStoneMaterial from './statuario/StatuarioStoneMaterial.ts'
import VerdantiqueStoneMaterial from './verdantique/VerdantiqueStoneMaterial.ts'
import WeserStoneMaterial from './weser/WeserStoneMaterial.ts'

/** The material of every stone there is by its id, unbuilt, in the order of `stoneIds`; the first is the default seed’s. */
export const stones = {
  sawn: SawnStoneMaterial,
  statuario: StatuarioStoneMaterial,
  porphyry: PorphyryStoneMaterial,
  larvikite: LarvikiteStoneMaterial,
  weser: WeserStoneMaterial,
  verdantique: VerdantiqueStoneMaterial,
} as const satisfies Record<StoneId, new () => Material>

/** Builds the material of a stone, a new one for every call. */
export function createStone(id: StoneId): Material {
  const Stone = stones[id]
  return new Stone
}

export type {StoneId} from './lib/stoneIds.ts'
