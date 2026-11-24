import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import {PerspectiveCamera} from 'three/webgpu'

import {viewTuning} from '#src/lib/worldTuning/ViewTuningModule.ts'

/**
 * Gives the game camera the field of view of the world tuning of `?development` in every graphics mode, as its slider and Numpad + and − (`stepFov`) change it.
 * The camera’s zoom treats a new field of view as the one to zoom from and return to.
 */
export default function TunedFov() {
  const camera = useThree(state => state.camera)
  const fov = viewTuning.useValues(state => state.fov)
  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      // eslint-disable-next-line react-hooks/immutability -- the world tuning owns the camera’s field of view in development.
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, fov])
  return null
}
