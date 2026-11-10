import type AmbienceEmitter from 'ambience-emitter'

import optis from 'optis'
import {useEffect, useState} from 'react'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

const enabledValues = new Set<unknown>([true, '', 'true'])
const flagsSchema = optis({
  defaults: {
    show_ambience_emitters: false,
  },
  normalizations: {
    show_ambience_emitters(value: unknown) {
      return enabledValues.has(value)
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

/** Adds an emitter, returning how to stop and remove it again. */
export function addAmbienceEmitter(emitter: AmbienceEmitter) {
  useAmbienceEmitters.setState(state => ({emitters: [...state.emitters, emitter]}))
  return () => {
    emitter.stop()
    useAmbienceEmitters.setState(state => ({emitters: state.emitters.filter(candidate => candidate !== emitter)}))
  }
}

/** Sounds an emitter of this class at its default position while the calling component is mounted, returning it; `rooms` replaces the rooms it sounds in by default. */
export function useAmbienceEmitter<Emitter extends AmbienceEmitter>(EmitterClass: new (position?: undefined, rooms?: ReadonlyArray<string>) => Emitter, rooms?: ReadonlyArray<string>) {
  const [emitter] = useState(() => new EmitterClass(undefined, rooms))
  useEffect(() => addAmbienceEmitter(emitter), [emitter])
  return emitter
}
