import {useThree} from '@react-three/fiber'
import {useEffect} from 'react'

import detachedCanvases from '#src/lib/rendering/detachedCanvases.ts'
import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {readFastStreamBudget, readStreamBudget} from '#src/lib/rendering/streamBudget.ts'
import worldClock from '#src/lib/worldClock.ts'

const regularBudget = readStreamBudget()
const fastBudget = readFastStreamBudget()

/**
 * Streams with `?fast_stream_budget` while the world is frozen under the Escape key’s pause menu, where none of its frames moves, and with `?stream_budget` otherwise.
 * A canvas of its own in the page, like the studio view of a work up close in the menu, brings the regular budget back for as long as it is there, so it draws at the display’s rate.
 * It follows the clock and the canvases directly rather than through React’s next commit, so the first frozen frame already builds more.
 */
export default function StreamPace() {
  const renderer = useThree(state => state.renderer)
  useEffect(() => {
    if (!(renderer instanceof GalleryRenderer)) {
      return
    }
    const apply = () => {
      renderer.setStreamBudget(worldClock.frozen && !detachedCanvases.active ? fastBudget : regularBudget)
    }
    apply()
    const unsubscribers = [worldClock.subscribe(apply), detachedCanvases.subscribe(apply)]
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      renderer.setStreamBudget(regularBudget)
    }
  }, [renderer])
  return null
}
