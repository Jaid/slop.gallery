import {bastionNetwork, lodgeSpurEnd} from '#src/lib/gallery/bastionNetwork.ts'
import {cisternWalls} from '#src/lib/gallery/cistern/cistern.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import {routeCurveTolerance} from '#src/lib/gallery/passages/RoutedPassage.ts'

import {localWalls} from '../lib/walls.ts'

/** The Bastion's taller stone skirting: 30 cm lower band and 10 cm projecting cap. */
export const bastionBaseboard = {
  baseboardCapHeight: 0.1,
  baseboardHeight: 0.4,
} as const

// The connected passage network’s walls, the end of the spur toward the Lodge and the cistern’s, every one cut as coarsely as the routed passages’ curved walls, round its openings too.
const walls = localWalls('bastion', roomOrigins.bastion, [...bastionNetwork.flatMap(passage => passage.walls), lodgeSpurEnd, ...cisternWalls])
export default Object.fromEntries(Object.entries(walls).map(([id, wall]) => [id, {
  curveTolerance: routeCurveTolerance,
  ...wall,
  ...bastionBaseboard,
}]))
