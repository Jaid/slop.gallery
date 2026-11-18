import {useShallow} from 'zustand/react/shallow'

import world from '#src/worlds/current.ts'

import {useGallery} from './store.ts'

/** The same works in the scene, the collection and the minimap, including loose works between rooms. */
export default function usePortraitsInReach() {
  return useGallery(useShallow(s => (world.reach.limited ? s.portraits.filter(portrait => world.portraitInReach(portrait)) : s.portraits)))
}
