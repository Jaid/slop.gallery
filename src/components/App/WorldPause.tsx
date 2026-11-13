import type {RootState} from '@react-three/fiber'

import {useStore} from '@react-three/fiber'
import {useLayoutEffect} from 'react'

import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import worldTime from '#src/lib/worldTime.ts'

/** Stop the whole Canvas scheduler, including physics and useFrame callbacks, without unmounting the world or clearing the last image. React’s menu stays interactive. */
export default function WorldPause() {
  const store = useStore()
  useLayoutEffect(() => {
    let previous: RootState['frameloop'] | undefined
    const restore = () => {
      if (previous !== undefined) {
        store.getState().setFrameloop(previous)
        previous = undefined
      }
    }
    const sync = () => {
      const {renderer, setFrameloop} = store.getState()
      if (worldTime.paused) {
        previous ??= store.getState().frameloop
        setFrameloop('never')
        if (renderer instanceof GalleryRenderer) {
          renderer.stopAnimation()
        }
      } else {
        restore()
      }
    }
    const unsubscribe = worldTime.subscribe(sync)
    sync()
    return () => {
      unsubscribe()
      restore()
    }
  }, [store])
  return null
}
