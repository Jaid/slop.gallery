import type {PortraitFrameId} from './frameParameter.ts'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

/** the frames a room or a fusion ingredient brings: one, or several, of which {@link pickFrame} draws one */
export type FrameChoice = PortraitFrameId | ReadonlyArray<PortraitFrameId>

/** Every frame of the choice. */
export function choiceFrames(choice: FrameChoice): ReadonlyArray<PortraitFrameId> {
  return typeof choice === 'string' ? [choice] : choice
}

/**
 * The default environment takes the first frame. Other seeds draw one per work in a room, or once per game for an ingredient.
 */
export function pickFrame(seed: number, choice: FrameChoice, work?: string): PortraitFrameId {
  if (typeof choice === 'string') {
    return choice
  }
  if (isDefaultSeed(seed)) {
    return choice[0]
  }
  if (work === undefined) {
    return environmentRandom(seed).makeChild(['frame', ...choice]).rollItem(choice)
  }
  return environmentRandom(seed).makeChild(['work-frame', work, ...choice]).rollItem(choice)
}
