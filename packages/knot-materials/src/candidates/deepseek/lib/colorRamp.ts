import type {Node} from 'three/webgpu'

import {color, mix} from 'three/tsl'

/** Piecewise-linear gradient through an ordered list of sRGB stops, evaluated in linear light. */
export function colorRamp(t: Node<'float'>, stops: ReadonlyArray<number>) {
  if (stops.length < 2) {
    throw new RangeError('A color ramp needs at least two stops.')
  }
  const scaled = t.clamp(0, 1).mul(stops.length - 1)
  let result: Node<'vec3'> = mix(color(stops[0]), color(stops[1]), scaled.clamp(0, 1))
  for (let index = 2;index < stops.length;index++) {
    result = mix(result, color(stops[index]), scaled.sub(index - 1).clamp(0, 1))
  }
  return result
}
