import type {PortraitFrameId} from './frameParameter.ts'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

/** the frames a room or a fusion ingredient brings: one, or several, of which {@link pickFrame} draws one */
export type FrameChoice = PortraitFrameId | ReadonlyArray<PortraitFrameId>

/** Every frame of the choice. */
export function choiceFrames(choice: FrameChoice): ReadonlyArray<PortraitFrameId> {
  return typeof choice === 'string' ? [choice] : choice
}

/**
 * The one frame of the choice to wear in the game of `seed`, drawn by the seed among the frames of a choice of several: for the work with the id `work`, which then wears its own roll all game long, or without one, once for the whole game. Every choice draws on its own. A room’s works, the ones with a `work`, all wear the room’s first frame in the default environment instead.
 */
export function pickFrame(seed: number, choice: FrameChoice, work?: string): PortraitFrameId {
  if (typeof choice === 'string') {
    return choice
  }
  if (work === undefined) {
    return environmentRandom(seed).makeChild(['frame', ...choice]).rollItem(choice)
  }
  if (isDefaultSeed(seed)) {
    return choice[0]
  }
  return environmentRandom(seed).makeChild(['work-frame', work, ...choice]).rollItem(choice)
}
