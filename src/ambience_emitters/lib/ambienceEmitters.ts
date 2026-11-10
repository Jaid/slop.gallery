import type {AmbienceEmitterId} from '../index.ts'
import type {EmitterPlacement} from './EmitterPlacement.ts'
import type AmbienceEmitter from 'ambience-emitter'

import optis from 'optis'
import {useEffect, useState} from 'react'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

import {ambienceEmitters} from '../index.ts'

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

/** Sounds an ambience emitter of the kind `emitter` where the placement says while the calling component is mounted, returning it; the placement is read once. */
export function useAmbienceEmitter({emitter: kind, ...placement}: EmitterPlacement & {emitter: AmbienceEmitterId}): AmbienceEmitter {
  const [emitter] = useState(() => {
    const Emitter = ambienceEmitters[kind]
    return new Emitter(placement)
  })
  useEffect(() => addAmbienceEmitter(emitter), [emitter])
  return emitter
}
