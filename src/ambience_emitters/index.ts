import FireEmitter from './fire/FireEmitter.ts'
import FountainEmitter from './fountain/FountainEmitter.ts'
import HumEmitter from './hum/HumEmitter.ts'

/** every kind of ambience emitter there is by its id; each sounds wherever it is placed, as often as it is placed */
export const ambienceEmitters = {
  fire: FireEmitter,
  fountain: FountainEmitter,
  hum: HumEmitter,
} as const

/** the id of one of the kinds of ambience emitters */
export type AmbienceEmitterId = keyof typeof ambienceEmitters

export type {EmitterPlacement} from './lib/EmitterPlacement.ts'
