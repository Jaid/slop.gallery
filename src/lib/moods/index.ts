import FusionMood from './FusionMood.ts'
import HalloweenMood from './HalloweenMood.ts'
import HorrorMood from './HorrorMood.ts'
import PaintMood from './PaintMood.ts'
import SpookMood from './SpookMood.ts'

export const fusionMood = new FusionMood
export const halloweenMood = new HalloweenMood
export const horrorMood = new HorrorMood
export const paintMood = new PaintMood
export const spookMood = new SpookMood
export const moods = [fusionMood, halloweenMood, horrorMood, paintMood, spookMood] as const

export type {default as Mood} from './base/Mood.ts'
