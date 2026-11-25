import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

/**
 * Hand-rubbed architectural bronze: warm satin metal with soft, darker patina in places the hand never polishes.
 * Given an `environment`, like a softly lit studio, it reflects that instead of the scene’s, which keeps a cast hanging in the open readable; it borrows the environment, never disposing it.
 */
export default class BronzeMaterial extends MeshStandardNodeMaterial {
  constructor({environment}: {environment?: Texture} = {}) {
    super({
      envMap: environment ?? null,
      envMapIntensity: environment ? 0.5 : 1,
      metalness: 1,
      roughness: 0.34,
    })
    const patina = mx_noise_float(positionGeometry.mul(7)).mul(0.5).add(0.5).smoothstep(0.35, 0.8)
    const grain = mx_noise_float(positionGeometry.mul(90)).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(78, 52, 70)), color(hsl.integer(71, 51, 45)), patina.mul(0.7)).mul(grain.mul(0.08).add(0.96))
    this.roughnessNode = patina.mul(0.16).add(grain.mul(0.05)).add(0.26)
  }
}
