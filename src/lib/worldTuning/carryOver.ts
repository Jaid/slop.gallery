import type {PlayerPose} from '#src/lib/gallery/types.ts'
import type {TuningValues} from './controls.ts'

/** What the world tuning carries over the reload one of its values asks for: every value that left the one the page started with, by module, where the player was and whether the panel showed. */
export type TuningCarryOver = {
  changes: Record<string, TuningValues>
  flying: boolean
  open: boolean
  pose: PlayerPose
}

/** `sessionStorage` key of what the world tuning carries over a reload */
export const carryOverKey = 'world-tuning-carry-over'

/** Takes what the reload before this page carried over, once, so a reload of its own starts afresh. */
function takeCarryOver(): TuningCarryOver | undefined {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  const stored = sessionStorage.getItem(carryOverKey)
  sessionStorage.removeItem(carryOverKey)
  return stored ? JSON.parse(stored) as TuningCarryOver : undefined
}

/** what the world tuning carried over the reload that opened this page, if it did */
export const carriedTuning = takeCarryOver()

/** The values of the module that the reload before this page carried over, only those of keys it has, of the type it has them in. */
export function carriedValues<Values extends TuningValues>(id: string, initial: Values): Partial<Values> {
  const carried = carriedTuning?.changes[id] ?? {}
  return Object.fromEntries(Object.entries(carried).filter(([key, value]) => key in initial && typeof value === typeof initial[key])) as Partial<Values>
}
