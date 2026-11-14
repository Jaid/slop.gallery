import {Suspense, useSyncExternalStore} from 'react'

import {cameraPose, useGallery} from '#src/lib/gallery.ts'
import subscribeToFrames from '#src/lib/subscribeToFrames.ts'
import world from '#src/worlds/current.ts'

import css from './style.module.sass'

const {Minimap: WorldMinimap} = world

/** The world’s map of the floor the player is on, which follows the player to another floor, like a teleport behind the menu. */
export default function Minimap() {
  const room = useGallery(s => s.room)
  const isLower = () => world.isLowerFloor(world.roomById(room), cameraPose.position)
  const lower = useSyncExternalStore(subscribeToFrames, isLower, isLower)
  return <section className={css.container} aria-label={lower ? 'Lower gallery map' : 'Upper gallery map'} data-testid='minimap'>
    <Suspense><WorldMinimap lower={lower} /></Suspense>
  </section>
}
