import {useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'

import overlay from '#src/lib/overlay/index.ts'

/** Connect this camera to every producer’s drawings while the scene UI is visible. */
export default function WorldOverlay({visible}: {visible: boolean}) {
  const camera = useThree(state => state.camera)
  const renderer = useThree(state => state.renderer)
  useLayoutEffect(() => (visible ? overlay.attach(camera, renderer) : undefined), [camera, renderer, visible])
  return null
}
