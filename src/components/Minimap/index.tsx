import {Suspense, useSyncExternalStore} from 'react'

import {cameraPose, useGallery} from '#src/lib/gallery.ts'
import world from '#src/worlds/current.ts'

import css from './style.module.sass'

const {Minimap: WorldMinimap} = world
/** Calls the listener every frame, as the camera moves without telling anyone. */
const subscribeToFrames = (listener: () => void) => {
  let frame = requestAnimationFrame(function follow() {
    listener()
    frame = requestAnimationFrame(follow)
  })
  return () => cancelAnimationFrame(frame)
}

/** The world’s map of the floor the player is on, which follows the player to another floor, like a teleport behind the menu. */
export default function Minimap() {
  const room = useGallery(s => s.room)
  const isLower = () => world.isLowerFloor(world.roomById(room), cameraPose.position)
  const lower = useSyncExternalStore(subscribeToFrames, isLower, isLower)
  return <section className={css.container} aria-label={lower ? 'Lower gallery map' : 'Upper gallery map'} data-testid='minimap'>
    <Suspense><WorldMinimap lower={lower} /></Suspense>
  </section>
}
