import BatsEffect from './bats/BatsEffect.ts'
import BloodEffect from './blood/BloodEffect.ts'
import GhostsEffect from './ghosts/GhostsEffect.ts'
import StrokesEffect from './strokes/StrokesEffect.ts'

export const batsEffect = new BatsEffect
export const bloodEffect = new BloodEffect
export const ghostsEffect = new GhostsEffect
export const strokesEffect = new StrokesEffect
/** every effect there is, by the orb it belongs to */
export const fusionEffects = [batsEffect, bloodEffect, ghostsEffect, strokesEffect] as const

export type {EffectShow, default as FusionEffect} from './base/FusionEffect.ts'
