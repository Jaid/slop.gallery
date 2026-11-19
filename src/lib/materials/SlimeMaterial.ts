import type {OkhslTuple} from 'okhsl'

import {okhsl} from 'okhsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {studioEnvironment} from './metal.ts'

/** the slime’s green and the darker green it glows in, in OkHSL: hue in degrees, saturation and lightness in percent */
export const slimeColors = {
  color: [134, 94, 68],
  emissive: [138, 98, 49],
} as const satisfies Record<string, OkhslTuple>

/** The green slime of the gallery’s icon, which the Sloperator wears in front of his face: wet and glossy, with a faint glow of its own, so it reads as slime in the dark too. `hueShift` turns both of its greens round the hue circle by that many degrees, keeping their saturation and lightness. */
export default class SlimeMaterial extends MeshPhysicalNodeMaterial {
  constructor(hueShift = 0) {
    const [hue, saturation, lightness] = slimeColors.color
    const [glowHue, glowSaturation, glowLightness] = slimeColors.emissive
    super({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: `#${okhsl(hue + hueShift, saturation, lightness)}`,
      emissive: `#${okhsl(glowHue + hueShift, glowSaturation, glowLightness)}`,
      emissiveIntensity: 0.18,
      envMap: studioEnvironment,
      envMapIntensity: 0.7,
      roughness: 0.22,
    })
    this.name = 'slime'
  }
}
