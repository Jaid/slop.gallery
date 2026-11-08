import type IntroOrbit from '../camera/IntroOrbit.ts'
import type {IntroDirection} from '../camera/IntroOrbit.ts'

import {create} from 'zustand'

import world from '#src/worlds/current.ts'

import {environmentPick} from '../environmentSeed.ts'
import {readRoom, readSpawn} from './spawn.ts'

/** Whether a URL leaves the camera to the intro: none of `?spawn`, `?room` or the test hooks of `?test=true`, which pose and teleport it, puts it anywhere else. */
export function readIntro(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  const url = new URL(input, 'http://localhost/')
  return !readSpawn(input) && !readRoom(input) && url.searchParams.get('test') !== 'true'
}

/** Which way the intro circles in the game of `seed`, a coin flip of its own. */
export function introDirection(seed: number): IntroDirection {
  return environmentPick(seed, 'intro-orbit', [1, -1] as const)
}

/** The orbit the camera circles behind the first menu until the player first enters, or null once the player has entered and in worlds and URLs without an intro. */
export const useIntro = create<{orbit: IntroOrbit | null}>(() => ({orbit: (readIntro() ? world.introOrbit : undefined) ?? null}))

/** Ends the intro for the rest of the page session. */
export function endIntro() {
  useIntro.setState({orbit: null})
}
