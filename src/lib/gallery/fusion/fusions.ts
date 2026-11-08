import type {FusionSpec} from './Fusion.ts'

import {create} from 'zustand'

import world from '#src/worlds/current.ts'

import {holdArtworkTexture} from '../../useArtworkTexture.ts'
import Fusion from './Fusion.ts'
import {portalIn} from './portalFrame.ts'

/** the fusions whose portals are open, which `Fusions` draws */
export const useFusions = create<{fusions: ReadonlyArray<Fusion>}>(() => ({fusions: []}))

/** Opens a fusion’s portal in front of its work, sized to the room around it, until the fusion closes. */
export function openFusion(spec: FusionSpec) {
  const fusion = new Fusion(spec, {
    frame: portalIn(spec.work, world),
    hold: image => {
      const {texture, release} = holdArtworkTexture(image)
      return {
        ready: texture,
        release,
      }
    },
    onClose: closed => useFusions.setState(state => ({fusions: state.fusions.filter(candidate => candidate !== closed)})),
  })
  useFusions.setState(state => ({fusions: [...state.fusions, fusion]}))
  return fusion
}
