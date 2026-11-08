import type {StanchionRingOptions} from '../railings/StanchionRingGeometry.ts'

import {defaultEgoOptions} from 'ego-player/motor'

import {environmentRoll} from '../../environmentSeed.ts'
import lowerGallery from '../lowerGallery.ts'
import {ropeTop, stanchionHeight} from '../railings/stanchion.ts'
import staircase from '../staircase.ts'
import {moonfallCrater} from './config.ts'

const room = lowerGallery.moonfall

/** the direction from the crater’s middle toward the foot of the stairs from the Antechamber, as an angle from +x toward +z: the middle of a rope faces it, never a stanchion */
export const fenceFacing = Math.atan2(staircase.returnZ - room.center[1], staircase.endX - room.center[0])

/** the least height the fence blocks walkers up to, well over the player’s step, which would otherwise climb the ropes that hang lowest */
export const fenceGuard = defaultEgoOptions.stepHeight + 0.1

/** the number of stanchions around the crater in the environment of `seed` */
export function fencePosts(seed: number) {
  const [fewest, most] = moonfallCrater.fencePosts
  return fewest + Math.floor(environmentRoll(seed, 'moonfall-fence-posts') * (most - fewest + 1))
}

/** how deep the ropes between `posts` stanchions sag: their middles hang as low as {@link moonfallCrater.fenceLowest} says for the fewest and the most stanchions, and in between by the span from post to post. Like ropes of one length, they hang deeper the closer their posts stand. */
export function fenceSag(posts: number) {
  const [fewest, most] = moonfallCrater.fencePosts
  const [lowestOfFewest, lowestOfMost] = moonfallCrater.fenceLowest
  // 0 for the widest span, with the fewest posts, and 1 for the narrowest, with the most
  const narrowing = (1 / fewest - 1 / posts) / (1 / fewest - 1 / most)
  return ropeTop - stanchionHeight * (lowestOfFewest + (lowestOfMost - lowestOfFewest) * narrowing)
}

/** the shape of the fence around the crater with `posts` stanchions */
export function fenceShape(posts: number): StanchionRingOptions {
  return {
    sag: fenceSag(posts),
    facing: fenceFacing,
    guard: fenceGuard,
  }
}
