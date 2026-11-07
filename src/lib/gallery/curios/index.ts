import Hatchet from './hatchet/Hatchet.ts'
import Helmet from './helmet/Helmet.ts'
import PaintingSet from './paintingSet/PaintingSet.ts'
import Pumpkin from './pumpkin/Pumpkin.ts'

export const pumpkin = new Pumpkin
export const hatchet = new Hatchet
export const helmet = new Helmet
export const paintingSet = new PaintingSet
/** every curio lying about the gallery when a game begins */
export const curios = [pumpkin, hatchet, helmet, paintingSet] as const

export type {default as Curio} from './base/Curio.ts'
