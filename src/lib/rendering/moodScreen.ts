import type Mood from '#src/moods/base/Mood.ts'
import type {Node} from 'three/webgpu'

import {Fn, If, uniform} from 'three/tsl'

import RoomMood from '#src/moods/base/RoomMood.ts'
import {moods} from '#src/moods/index.ts'

/** a mood’s screen shader showing at `amount` (0–1) and `age` seconds */
export type ShownScreen = {
  age: number
  amount: number
  mood: Mood
}

const createSlot = () => ({
  age: uniform(0),
  amount: uniform(0),
})
type ScreenSlot = ReturnType<typeof createSlot>

const slots = new Map<Mood, ScreenSlot>
const slotFor = (mood: Mood) => {
  let slot = slots.get(mood)
  if (!slot) {
    slot = createSlot()
    slots.set(mood, slot)
  }
  return slot
}

/**
 * Updates the uniform state for every mood screen shader showing in {@link screenMood} passes, and zeroes out every other slotted mood.
 */
export function paintMoodScreens(screens: ReadonlyArray<ShownScreen>) {
  const active = new Map<Mood, ShownScreen>
  for (const entry of screens) {
    active.set(entry.mood, entry)
    const slot = slotFor(entry.mood)
    slot.amount.value = entry.amount
    slot.age.value = entry.age
  }
  for (const [mood, slot] of slots) {
    if (active.has(mood)) {
      continue
    }
    slot.amount.value = 0
    slot.age.value = 0
  }
}

/** The current `{age, amount}` values last pushed for `mood`’s screen shader, or zeros when inactive. */
export function moodScreenState(mood: Mood) {
  const slot = slots.get(mood)
  return {
    age: slot?.age.value ?? 0,
    amount: slot?.amount.value ?? 0,
  }
}

/**
 * Runs every mood’s own screen shader over `frame`, a display-space color after `renderOutput` and `gradeMood`, stacking room moods beneath cast moods.
 * Each mood is gated on `amount > 0`, so inactive shaders do no GPU work.
 */
/** Moods in `candidates` that contribute a screen shader, ordered with room moods beneath cast moods. */
export function orderedScreenMoods(candidates: ReadonlyArray<Mood> = Object.values(moods)): ReadonlyArray<Mood> {
  return candidates.filter(mood => mood.screen).toSorted((a, b) => Number(!(a instanceof RoomMood)) - Number(!(b instanceof RoomMood)))
}

export function screenMood(frame: Node<'vec4'>, candidates: ReadonlyArray<Mood> = Object.values(moods)): Node<'vec4'> {
  let current = frame
  for (const mood of orderedScreenMoods(candidates)) {
    const {screen} = mood
    if (!screen) {
      continue
    }
    const slot = slotFor(mood)
    const input = current
    current = Fn(() => {
      const result = input.toVar('moodScreenResult')
      If(slot.amount.greaterThan(0), () => {
        result.assign(screen(result, {
          age: slot.age,
          amount: slot.amount,
        }))
      })
      return result
    })()
  }
  return current
}
