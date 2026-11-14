import {useFrame, useStore} from '@react-three/fiber'
import {useEffect, useLayoutEffect, useState} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import {galleryEvents, useGallery} from '#src/lib/gallery.ts'
import {useLighting} from '#src/lib/gallery/lighting.ts'
import {useHiddenUi} from '#src/lib/hiddenUi.ts'
import {loadingItems} from '#src/lib/loadingItems.ts'
import {useCustomGraphics} from '#src/lib/rendering/customGraphics.ts'
import FrozenFrames from '#src/lib/rendering/FrozenFrames.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import worldClock from '#src/lib/worldClock.ts'

/** what of the gallery’s state shows in the scene: its works, the one held with its placement preview, an image dragged over it and the props fusions used up */
const pictured = ['portraits', 'held', 'placement', 'dragging', 'consumed', 'remains'] as const
/** Something is underway that only further frames bring along: objects, pipelines, works and rooms still loading, or an image dragged over the scene, whose placement preview follows the pointer. */
const busy = () => useGallery.getState().dragging || loadingItems().length > 0

/**
 * Stops the canvas while the world is frozen, under the pause menu of the Escape key: no frame is drawn, so nothing of the world runs, neither its physics nor its animations, until the world goes on, which continues with a frame as long as the last one before.
 * It does so inside the Canvas, at once as the clock freezes, since Canvas props only reach the scene with React’s next commit.
 * The frozen moment is drawn again whenever it would show differently: on a resized canvas, in another graphics mode or with other values from the tuning panel, with a work hung, moved or dragged in, after a teleport, with the UI hidden or shown and, in development, after a hot update. No time passes in those frames (see `FrozenFrames`).
 */
export default function WorldFreeze() {
  const store = useStore()
  const [{frames, drawn}] = useState(() => {
    /** when the canvas last drew a frame, which a frame of the frozen world repeats, so no time passes in it */
    let moment: number | undefined
    return {
      frames: new FrozenFrames({
        busy,
        draw: () => {
          if (moment !== undefined) {
            store.getState().advance(moment)
          }
        },
        run: running => store.getState().setFrameloop(running ? 'always' : 'never'),
      }),
      drawn: (time: number) => {
        moment = time
      },
    }
  })
  // The graphics mode is React state of the page, so it gets here as a commit.
  const isHeavy = useGraphicsMode()
  const profile = useGraphicsModeValue(getGraphicsProfile)
  useFrame(({time}) => drawn(time))
  useLayoutEffect(() => frames.connect(), [frames])
  useEffect(() => {
    frames.refresh()
  }, [frames, isHeavy, profile])
  useEffect(() => {
    const refresh = () => frames.refresh()
    const unsubscribers = [
      store.subscribe((state, previous) => {
        // Whatever configures the canvas anew must not start its frames again.
        if (worldClock.frozen && state.frameloop !== 'never') {
          state.setFrameloop('never')
        }
        if (state.size !== previous.size || state.viewport.dpr !== previous.viewport.dpr || state.camera !== previous.camera) {
          refresh()
        }
      }),
      useGallery.subscribe((state, previous) => {
        if (pictured.some(key => state[key] !== previous[key])) {
          refresh()
        }
      }),
      useCustomGraphics.subscribe(refresh),
      useLighting.subscribe(refresh),
      useHiddenUi.subscribe(refresh),
    ]
    galleryEvents.addEventListener('teleport', refresh)
    // Bun’s types claim import.meta.hot always exists, but outside the Vite dev server it is undefined.
    const hot = import.meta.hot as ImportMeta['hot'] | undefined
    hot?.on('vite:afterUpdate', refresh)
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      galleryEvents.removeEventListener('teleport', refresh)
      hot?.off('vite:afterUpdate', refresh)
    }
  }, [frames, store])
  return null
}
