import * as candidates from './candidates/index.ts'
import * as entries from './entries/index.ts'
import KnotCandidate, {indexKnots} from './KnotCandidate.ts'

// Metadata only. Importing the catalog never evaluates material constructors.
export const knotCandidates = Object.values(candidates).map(data => new KnotCandidate(data, Object.values(entries).filter(entry => entry.candidateId === data.id)))
export const knotsById = indexKnots(knotCandidates)
export const knots = knotsById.values().toArray()

export * as entries from './entries/index.ts'
export {default as KnotCandidate} from './KnotCandidate.ts'
export {common, ethereal, prime, rare, default as rarities, special, unknown} from './rarities.ts'

export type {Rarity} from './rarities.ts'
export type {KnotAuthor, KnotCandidateData, KnotCandidateId, KnotData, KnotEntry, KnotId, KnotMaterialConstructor, KnotMaterialLoader, KnotPlaceholder, PlaceholderShading} from './types.ts'
