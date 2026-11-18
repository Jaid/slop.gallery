import type {DirectionalLight, Node} from 'three/webgpu'

import {uniform} from 'three/tsl'
import {Color} from 'three/webgpu'

/** the sun the world shines with, if any */
const sun: {current: DirectionalLight | null} = {current: null}
const shining = new Color

/**
 * The light of the world’s sun as it shines this frame, its color times its intensity, after the lighting preset, the moods and the light edits had their say; black without a sun or while it is off.
 * For materials that make up for the daylight their surroundings would bounce onto them, which the renderer leaves out without indirect light, like the walls of a lantern lit by the sky through its windows.
 */
export const daylight = uniform(shining).onRenderUpdate(() => {
  const light = sun.current
  return light ? shining.copy(light.color).multiplyScalar(light.intensity) : shining.setRGB(0, 0, 0)
}) as unknown as Node<'vec3'>

/** Lets `light` be the sun {@link daylight} follows, returning how to let go of it again. */
export function shineDaylightFrom(light: DirectionalLight) {
  sun.current = light
  return () => {
    if (sun.current === light) {
      sun.current = null
    }
  }
}
