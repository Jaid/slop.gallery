import {lazy, Suspense} from 'react'

import {useSpawnedOrbs} from '#src/lib/gallery/spawnedOrbs.ts'

// Loaded with the first spawned orb, which brings its own kind along.
const Orb = lazy(() => import('#component/Orb'))

/** The orbs brought into the world from outside the game, like the ingredient a film throws, in whichever world is loaded, each lying where it entered until something picks it up or throws it. */
export default function SpawnedOrbs() {
  const orbs = useSpawnedOrbs(s => s.orbs)
  return orbs.map(({id, orb, position}) => <Suspense key={id}><Orb id={id} orb={orb} position={position} /></Suspense>)
}
