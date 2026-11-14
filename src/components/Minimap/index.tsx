import {Suspense, useEffect, useState} from 'react'

import {cameraPose, useGallery} from '#src/lib/gallery.ts'
import world from '#src/worlds/current.ts'

import css from './style.module.sass'

const {Minimap: WorldMinimap} = world
const currentFloor = () => world.isLowerMapPosition(useGallery.getState().room, cameraPose.position)

export default function Minimap() {
  const room = useGallery(state => state.room)
  const [lower, setLower] = useState(() => world.isLowerMapPosition(room, cameraPose.position))
  useEffect(() => {
    // The camera can cross floors without changing rooms (stairs, the Bastion climb or V-viewing).
    // Read its live pose, but only rerender when the floor actually changes.
    let frame: number
    const update = () => {
      setLower(currentFloor())
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [])
  return <section className={css.container} aria-label='Current floor map' data-floor={lower ? 'lower' : 'upper'} data-testid='minimap'>
    <Suspense><WorldMinimap lower={lower} /></Suspense>
  </section>
}
