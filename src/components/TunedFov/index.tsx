import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import {PerspectiveCamera} from 'three/webgpu'

import {useCustomGraphics} from '#src/lib/rendering/customGraphics.ts'

/**
 * Gives the game camera the field of view of the tuning panel of `?development` in every graphics mode, as its slider and Numpad + and − (`stepFov`) change it.
 * The camera’s zoom treats a new field of view as the one to zoom from and return to.
 */
export default function TunedFov() {
  const camera = useThree(state => state.camera)
  const fov = useCustomGraphics(state => state.fov)
  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      // eslint-disable-next-line react-hooks/immutability -- the panel owns the camera’s field of view in development.
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, fov])
  return null
}
