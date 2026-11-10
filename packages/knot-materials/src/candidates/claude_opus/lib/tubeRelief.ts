import type {Node} from 'three/webgpu'

import {negateOnBackSide, transformNormalToView, uv, vec2} from 'three/tsl'

import {knotFrame} from './knotFrameOpus55.ts'

export type TubeHeight = (tube: Node<'vec2'>) => Node<'float'>
/**
 * Exact per-fragment normal of the knot tube displaced along its normal by `height` (object units).
 * Central differences in UV space avoid the 2×2 quad stepping of screen-derivative bump mapping,
 * so relief stays crisp at macro distances. The height function must be periodic in UV.
 */
export function tubeRelief(height: TubeHeight, {tube = uv(), epsilon = 0.00025}: {
  epsilon?: number
  tube?: Node<'vec2'>
} = {}) {
  const surface = (at: Node<'vec2'>) => {
    const frame = knotFrame(at)
    return frame.position.add(frame.normal.mul(height(at)))
  }
// The tube circumference is ~8.8× shorter than its length, so V needs a proportionally larger step.
  const du = vec2(epsilon, 0)
  const dv = vec2(0, epsilon * 8.8)
  const alongTube = surface(tube.add(du)).sub(surface(tube.sub(du)))
  const aroundTube = surface(tube.add(dv)).sub(surface(tube.sub(dv)))
  const frame = knotFrame(tube)
  const raw = alongTube.cross(aroundTube).normalize()
// TorusKnotGeometry winds V clockwise around the tangent, so orient toward the undisplaced outward normal.
  const objectNormal = raw.mul(raw.dot(frame.normal).sign().max(0).mul(2).sub(1))
  return {
    frame,
    objectNormal,
    viewNormal: negateOnBackSide(transformNormalToView(objectNormal).normalize()),
  }
}
