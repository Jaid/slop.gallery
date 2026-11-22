import type {sunGeometry} from '#src/lib/gallery/sun.ts'

import {useGraphicsModeValue} from 'use-graphics-mode'

import {getGraphicsProfile, getSunShadowSettings} from '#src/lib/rendering/graphicsMode.ts'
import {getShadowProps} from '#src/lib/rendering/shadowFilterNodes.ts'
import {moonlight} from '#src/worlds/sandbox/moon.ts'

/**
 * The moon over the Sandbox, shining from where `geometry` puts it, which the render pipeline marches for its shafts in heavy graphics, the room’s shell shadowing all of it but what it lets the moon in on.
 * Without shadows, nothing would keep it off the rest of the room, so it only shines with them.
 */
export default function SandboxMoonlight({geometry, intensity = moonlight.intensity, mapSize = 2048}: {
  geometry: ReturnType<typeof sunGeometry>
  /** how strongly it shines, the Cell’s moon’s by default */
  intensity?: number
  /** texels along each axis of its shadow map in heavy graphics, as many as a centimeter each across the Cell takes by default */
  mapSize?: number
}) {
  const profile = useGraphicsModeValue(getGraphicsProfile)
  if (!profile.shadows) {
    return null
  }
  const settings = getSunShadowSettings(profile, mapSize)
  const {bottom, far, left, near, normalBias, right, top} = geometry.shadow
  // A new filter needs a new shadow, so the light is built anew.
  return <directionalLight key={settings.samples} castShadow color={moonlight.color} intensity={intensity} name='moon' position={geometry.position} shadow-camera-bottom={bottom} shadow-camera-far={far} shadow-camera-left={left} shadow-camera-near={near} shadow-camera-right={right} shadow-camera-top={top} shadow-normalBias={normalBias} {...getShadowProps(settings)} />
}
