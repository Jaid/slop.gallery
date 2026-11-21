import type {AmbienceEmitterId} from '../index.ts'
import type {EmitterPlacement} from './EmitterPlacement.ts'
import type AmbienceEmitter from 'ambience-emitter'

import optis from 'optis'
import {useEffect, useState} from 'react'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

import isFlagOn from '#src/lib/permalinkFlag.ts'

import {ambienceEmitters} from '../index.ts'

const flagsSchema = optis({
  defaults: {
    show_ambience_emitters: false,
  },
  normalizations: {
    show_ambience_emitters(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?show_ambience_emitters` flag that marks every ambience emitter; a bare `?show_ambience_emitters` counts as enabled. */
export function readShowAmbienceEmitters(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: flagsSchema}).show_ambience_emitters
}

/** whether this page shows ambience emitter markers, read once at startup */
export const isShowingAmbienceEmitters = readShowAmbienceEmitters()

/** the emitters of the mounted world; `AmbienceListener` starts them once the sound engine exists */
export const useAmbienceEmitters = create<{emitters: ReadonlyArray<AmbienceEmitter>}>(() => ({emitters: []}))

/**
 * The fence a listener hears the emitter in who is in the fences with the ids, like a player’s whereabouts: the first of them the emitter sounds in, or undefined where it sounds in none of them.
 * An emitter asks for the one room its listener is in, which this fence stands in for, so that it sounds wherever any of the listener’s fences lets it.
 */
export function hearingFence(emitter: AmbienceEmitter, fences: ReadonlyArray<string>) {
  return fences.find(fence => emitter.isInside(fence))
}

/** Adds an emitter, returning how to stop and remove it again. */
export function addAmbienceEmitter(emitter: AmbienceEmitter) {
  useAmbienceEmitters.setState(state => ({emitters: [...state.emitters, emitter]}))
  return () => {
    emitter.stop()
    useAmbienceEmitters.setState(state => ({emitters: state.emitters.filter(candidate => candidate !== emitter)}))
  }
}

/** Sounds an ambience emitter of the kind `emitter` where the placement says while the calling component is mounted, returning it; the placement is read once. */
export function useAmbienceEmitter({emitter: kind, ...placement}: EmitterPlacement & {emitter: AmbienceEmitterId}): AmbienceEmitter {
  const [emitter] = useState(() => {
    const Emitter = ambienceEmitters[kind]
    return new Emitter(placement)
  })
  useEffect(() => addAmbienceEmitter(emitter), [emitter])
  return emitter
}
