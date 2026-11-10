import type {Light, LightShadow} from 'three/webgpu'

import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import ShadowCache, {ShadowRefresher} from 'three-shadow-cache'

import {useGallery} from '#src/lib/gallery.ts'
import {GalleryRenderer} from '#src/lib/rendering/GalleryRenderer.ts'
import {isShadowSlot} from '#src/lib/rendering/lightLevels.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

type ShadowCastingLight = Light & {shadow: LightShadow}

/**
 * Keeps every shadow map until something in its light’s reach moves, appears or disappears, or the light itself moves, for worlds without `RoomCulling`, which does the same as part of its culling. The shadow pool’s slots only render while lent to a light, so the idle ones cost nothing.
 * Maps that left out objects still streaming in render again in turn until they hold them all, and every map renders afresh once loading is done, as the maps drawn behind the loading screen skip what they drew before.
 */
export default function ShadowCaching() {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const ready = useGallery(state => state.ready)
  // A layout effect, so that the cache is in place before the first frame renders every map. A new cache once ready renders every map again.
  useLayoutEffect(() => {
    if (!(renderer instanceof GalleryRenderer)) {
      return
    }
    const shadows = new ShadowCache
    const refresher = new ShadowRefresher
    const incomplete = renderer.shadowIncomplete.bind(renderer)
    renderer.setCuller(() => {
      scene.traverse(object => {
        const light = object as Partial<ShadowCastingLight>
        if (light.isLight && light.shadow) {
          // Lets streaming tell the maps’ passes apart from the views’, which it gates differently.
          renderer.shadowCameras.add(light.shadow.camera)
          refresher.visit(light as ShadowCastingLight, incomplete)
        }
      })
      refresher.endFrame()
      shadows.update(scene, {
        hidden: renderer.hidden,
        active: light => !isShadowSlot(light) || shadowPool.isInUse(light),
      })
    })
    return () => {
      renderer.setCuller(null)
      shadows.dispose()
    }
  }, [ready, renderer, scene])
  return null
}
