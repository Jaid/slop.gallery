import type KnotMaterial from './lib/KnotMaterial.ts'
import type {Rarity} from './rarities.ts'
import type {Texture} from 'three/webgpu'

export type KnotId = keyof typeof import('./entries/index.ts')
export type KnotCandidateId = keyof typeof import('./candidates/index.ts')
export type {Vec3} from 'math'

export type PlaceholderShading = 'fabric' | 'ghost' | 'glass' | 'liquid' | 'metal' | 'smooth' | 'stone'
export type KnotPlaceholder = {
  color: number
  shading: PlaceholderShading
}

export type KnotAuthor = {
  model: {
    effortLevel?: string
    slug?: string
    title: string
  }
}

export type KnotData = {
  author: KnotAuthor
  candidateId: KnotCandidateId
  /** Unix timestamp in seconds when the knot was created. */
  createdAt: number
  /** Conservative maximum vertex displacement in meters, used for culling and collision bounds. */
  displacement?: number
  flavorText: string
  harness?: string
  id: string
  placeholder: KnotPlaceholder
  title: string
}

export type KnotCandidateData = {
  icon: string
  id: string
  title: string
}

export type KnotEntry = KnotData & {
  candidate: KnotCandidateData
  modelTitle: string
  rarity: Rarity
}

export type KnotMaterialConstructor = new (environment: Texture) => KnotMaterial
export type KnotMaterialModule = {default: KnotMaterialConstructor}
/** hands out the material class of an entry, at once or once its module has loaded */
export type KnotMaterialLoader = (entry: Pick<KnotEntry, 'id'>) => KnotMaterialConstructor | Promise<KnotMaterialConstructor>
