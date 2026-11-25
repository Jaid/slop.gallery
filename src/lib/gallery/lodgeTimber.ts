import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'

/** The material options of the pale timber framing the Lodge’s tunnel and the corridor’s portals. */
export default function lodgeTimber(grain: Texture) {
  return {
    map: grain,
    bumpMap: grain,
    bumpScale: 0.012,
    color: hsl.integer(74, 53, 83),
    roughness: 0.72,
    envMapIntensity: 0.2,
  }
}
