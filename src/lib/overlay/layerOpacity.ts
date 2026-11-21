import type {LayerOptions} from './layer.ts'
import type {Node} from 'three/webgpu'

import {cameraPosition, vec3} from 'three/tsl'

import {defaultFade} from './layer.ts'
import {obstructedOpacity} from './obstruction.ts'

/** Layer-wide per-pixel visibility for strokes and filled surfaces. Default obstruction never samples world depth. */
export default function layerOpacity(base: Node<'float'>, point: Node<'vec3'>, {fade, obstructedOpacityFactor = 1}: LayerOptions) {
  let opacity = base
  if (fade !== false) {
    const {start, end, power, heightWeight} = {
      ...defaultFade,
      ...fade,
    }
    const distance = point.sub(cameraPosition).mul(vec3(1, heightWeight, 1)).length()
    opacity = opacity.mul(distance.smoothstep(start, end).oneMinus().pow(power))
  }
  return obstructedOpacityFactor === 1 ? opacity : opacity.mul(obstructedOpacity(point, obstructedOpacityFactor))
}
