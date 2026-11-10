import BatsEffect from './bats/BatsEffect.ts'
import BloodEffect from './blood/BloodEffect.ts'
import EyesEffect from './eyes/EyesEffect.ts'
import GhostsEffect from './ghosts/GhostsEffect.ts'
import StrokesEffect from './strokes/StrokesEffect.ts'
import TendrilsEffect from './tendrils/TendrilsEffect.ts'

/** every party effect there is by its id */
export const partyEffects = {
  bats: new BatsEffect,
  blood: new BloodEffect,
  eyes: new EyesEffect,
  ghosts: new GhostsEffect,
  strokes: new StrokesEffect,
  tendrils: new TendrilsEffect,
} as const

/** the id of one of the party effects */
export type PartyEffectId = keyof typeof partyEffects

export type {default as PartyEffect} from './base/PartyEffect.ts'
export type {default as PartyShow} from './lib/PartyShow.ts'
export type {PartyOffset, PartyOptions, PartyPlacement, PartySite} from './lib/partySite.ts'
