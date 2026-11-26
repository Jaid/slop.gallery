import {useFrame, useThree} from '@react-three/fiber'

import {shadowsEnabled} from '#src/lib/rendering/graphicsMode.ts'
import {applyLightLevels} from '#src/lib/rendering/lightLevels.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

/** Applies light gains and switched-off lights right before the frame is drawn, after every regular frame callback, so they act on what the lights’ owners set this frame. When shadows are enabled, the shadow pool then copies the lights it shades. */
export default function LightLevels() {
  const scene = useThree(state => state.scene)
  // The finish phase runs after the frame is drawn, too late for lights whose owners set them every frame.
  useFrame(({camera}) => {
    applyLightLevels(scene)
    if (shadowsEnabled) {
      shadowPool.update(scene, camera)
    }
  }, {
    id: 'light-levels',
    before: 'render',
  })
  return null
}
