import type {sunGeometry} from '#src/lib/gallery/sun.ts'

import {useGraphicsModeValue} from 'use-graphics-mode'

import {getGraphicsProfile, getSunShadowSettings} from '#src/lib/rendering/graphicsMode.ts'
import {getShadowProps} from '#src/lib/rendering/shadowFilterNodes.ts'
import {moonlight} from '#src/worlds/sandbox/moon.ts'

/**
 * The moon over the Sandbox, shining from where `geometry` puts it, which the render pipeline marches for its shafts in heavy graphics, the room’s shell shadowing all of it but what it lets the moon in on.
 * Without shadows, nothing would keep it off the rest of the room, so it only shines with them.
 */
export default function SandboxMoonlight({blur = 1, color = moonlight.color, geometry, intensity = moonlight.intensity, mapSize = 2048}: {
  /** a factor on how widely the graphics mode blurs the shadow’s edges, 1 by default */
  blur?: number
  /** as #rrggbb, the Cell’s moon’s by default */
  color?: string
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
  const sun = getSunShadowSettings(profile, mapSize)
  const settings = {
    ...sun,
    radius: sun.radius * blur,
  }
  const {bottom, far, left, near, normalBias, right, top} = geometry.shadow
  // A new filter needs a new shadow, so the light is built anew.
  return <directionalLight key={settings.samples} castShadow color={color} intensity={intensity} name='moon' position={geometry.position} shadow-camera-bottom={bottom} shadow-camera-far={far} shadow-camera-left={left} shadow-camera-near={near} shadow-camera-right={right} shadow-camera-top={top} shadow-normalBias={normalBias} {...getShadowProps(settings)} />
}
