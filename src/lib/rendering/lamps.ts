import type {Light} from 'three/webgpu'

import {useCallback} from 'react'

/** what the world says about a lamp it renders */
export type LampInfo = {
  /** the ids of the fences the player must be in one of for it to shine, like its room’s, everywhere if left out */
  fences?: ReadonlyArray<string>
  /** the lamp’s global id, also its light’s name */
  id: string
  /** whether it goes out with only the essential lamps */
  optional: boolean
}

const lights = new Map<string, Light>
const infos = new WeakMap<Light, LampInfo>

/** Makes a world’s lamp known by its id, returning how to forget it again. */
export function registerLamp(light: Light, info: LampInfo) {
  lights.set(info.id, light)
  infos.set(light, info)
  return () => {
    if (lights.get(info.id) === light) {
      lights.delete(info.id)
    }
  }
}

/** What the world says about the light, or undefined for a light that is none of its lamps, like a shadow pool’s slot. */
export function lampOf(light: Light) {
  return infos.get(light)
}

/** The light of the world’s lamp with the global id, once it has mounted. */
export function lampLight(id: string) {
  return lights.get(id)
}

/**
 * Finds the light of the world’s lamp with the global id, for a fixture that animates it, like a flickering fire or a swinging chandelier: call it where the light changes, like in a frame callback, as the lamp may only mount after the fixture.
 * The fixture may change its intensity, color and position every frame; the light sits at the scene’s root, so its position is in world meters.
 */
export function useLamp(id: string) {
  return useCallback(() => lights.get(id), [id])
}
