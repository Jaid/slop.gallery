import type {Node, Texture} from 'three/webgpu'

import {bumpMap, float, mx_noise_float, positionWorld, texture, vec3} from 'three/tsl'
import {Color, MeshStandardNodeMaterial} from 'three/webgpu'

/** Restrained architectural plaster: large mottling plus fine surface grain in heavy mode. */
export default class ArchitecturalPlasterMaterial extends MeshStandardNodeMaterial {
  constructor({baseColor, bounce, heavy, map, roughness}: {
    baseColor: number
    /** light the plaster gets from its surroundings beyond the scene’s lights, which it scatters back in its own color, like the daylight bounced into a lantern */
    bounce?: Node<'vec3'>
    heavy: boolean
    map?: Texture
    roughness: number
  }) {
    super({
      color: baseColor,
      map: heavy ? null : map,
      roughness,
      metalness: 0,
      envMapIntensity: 1,
    })
    const tint = vec3(...new Color(baseColor))
    const flat: Node<'vec3'> = map ? texture(map).rgb.mul(tint) : tint
    if (!heavy) {
      if (bounce) {
        this.emissiveNode = flat.mul(bounce)
      }
      return
    }
    const broad = mx_noise_float(positionWorld.mul(vec3(0.34, 0.22, 0.34)))
    const grain = mx_noise_float(positionWorld.mul(18))
    const height = broad.mul(0.22).add(grain.mul(0.055))
    const plaster = flat.mul(broad.mul(0.026).add(grain.mul(0.008)).add(1))
    this.colorNode = plaster
    this.roughnessNode = broad.mul(0.035).add(grain.mul(0.012)).add(roughness).clamp(0.78, 0.97)
    this.normalNode = bumpMap(height, float(0.0011))
    if (bounce) {
      this.emissiveNode = plaster.mul(bounce)
    }
  }
}
