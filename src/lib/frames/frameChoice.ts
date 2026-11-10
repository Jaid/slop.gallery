import type {PortraitFrameId} from './frameParameter.ts'

import {environmentRandom} from '#src/lib/environmentSeed.ts'

/** the frames a room or a fusion ingredient brings: one, or several, of which {@link pickFrame} draws one */
export type FrameChoice = PortraitFrameId | ReadonlyArray<PortraitFrameId>

/** Every frame of the choice. */
export function choiceFrames(choice: FrameChoice): ReadonlyArray<PortraitFrameId> {
  return typeof choice === 'string' ? [choice] : choice
}

/**
 * The one frame of the choice to wear in the game of `seed`, drawn by the seed among the frames of a choice of several: for the work with the id `work`, which then wears its own roll all game long, or without one, once for the whole game. Every choice draws on its own.
 */
export function pickFrame(seed: number, choice: FrameChoice, work?: string): PortraitFrameId {
  if (typeof choice === 'string') {
    return choice
  }
  return environmentRandom(seed).makeChild(work === undefined ? ['frame', ...choice] : ['work-frame', work, ...choice]).rollItem(choice)
}
