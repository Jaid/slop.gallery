import type {FusionRemains, NarrationState, Placement, Portrait, Vec3} from './types.ts'

import {create} from 'zustand'

import world from '#src/worlds/current.ts'

import {readAiSettings} from '../ai/settings.ts'
import {audioOverride} from '../audio/audioParameter.ts'
import {readStored} from '../browserStorage.ts'
import {environmentSeed} from '../gameSeed.ts'
import defaultPortraits from './defaultPortraits.ts'
import {validateCollectionImages} from './imagePolicy.ts'

type State = {
  active: string | null
  activeLabel: string | null
  add: (portrait: Portrait) => void
  ai: boolean
  apiKey: string
  /** replaces the collection */
  commit: (portraits: Array<Portrait>) => void
  /** the ids of the props fusions used up, like orbs, which have left the world for good */
  consumed: ReadonlyArray<string>
  dragging: boolean
  held: string | null
  importFiles: ((files: Array<File>, target?: {
    direction: Vec3
    origin: Vec3
  }) => Promise<void>) | null
  importTarget: ((x: number, y: number) => {
    direction: Vec3
    origin: Vec3
  }) | null
  inspecting: string | null
  locked: boolean
  /** Remembers an interaction with a work; props and already marked works leave the state alone. */
  markInteracted: (id: string) => void
  /** Read-only projection for telemetry; the shared narrator owns playback and UI state. */
  narration: NarrationState | null
  notice: string
  placement: Placement | null
  portraits: Array<Portrait>
  ready: boolean
  /** what fusions leave of the props they use up, like the clear glass of themed orbs, from the moment their portals open */
  remains: ReadonlyArray<FusionRemains>
  remove: (id: string) => void
  revision: number
  /** the id of the room of the current world the player is in, or was in last when in a passage */
  room: string
  sound: boolean
  update: (id: string, patch: Partial<Portrait>) => void
}

export const useGallery = create<State>((set, get) => ({
  portraits: defaultPortraits(environmentSeed),
  active: null,
  activeLabel: null,
  held: null,
  consumed: [],
  remains: [],
  locked: false,
  ready: false,
  dragging: false,
  inspecting: null,
  notice: '',
  room: world.defaultRoom,
  placement: null,
  ai: false,
  // A key from ?openrouter_key stands in for the saved one on this page, without replacing it.
  apiKey: readAiSettings().openrouter_key || readStored('apiKey') || '',
  // An explicit ?audio wins over the player’s last switch.
  sound: audioOverride ?? readStored('audio') === 'true',
  narration: null,
  revision: 0,
  importFiles: null,
  importTarget: null,
  markInteracted: id => {
    const state = get()
    const portrait = state.portraits.find(candidate => candidate.id === id)
    if (portrait && !portrait.interacted) {
      state.update(id, {interacted: true})
    }
  },
  update: (id, patch) => set(s => {
    const portraits = s.portraits.map(p => (p.id === id ? {
      ...p,
      ...patch,
    } : p))
    if (patch.source !== undefined) {
      validateCollectionImages(portraits)
    }
    return {portraits}
  }),
  commit: portraits => {
    validateCollectionImages(portraits)
    set(s => ({
      portraits,
      revision: s.revision + 1,
      held: null,
      placement: null,
    }))
  },
  add: portrait => {
    const s = get()
    s.commit([...s.portraits, portrait])
  },
  remove: id => get().commit(get().portraits.filter(p => p.id !== id)),
}))
