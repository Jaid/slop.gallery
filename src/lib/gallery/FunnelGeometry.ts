import type {BufferGeometry} from 'three/webgpu'

import {LatheGeometry, TorusGeometry, Vector2} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'

/** a point of a turned outline: its radius and its height */
export type FunnelPoint = readonly [radius: number, y: number]

const segments = 64
function lathe(points: ReadonlyArray<FunnelPoint>) {
  return new LatheGeometry(points.map(([radius, y]) => new Vector2(radius, y)), segments)
}
/** The outline `distance` further out from its axis all along, each point moved out square to the outline round it. */
function offsetOutline(points: ReadonlyArray<FunnelPoint>, distance: number): Array<FunnelPoint> {
  return points.map(([radius, y], index) => {
    const [fromRadius, fromY] = points[Math.max(0, index - 1)]
    const [toRadius, toY] = points[Math.min(points.length - 1, index + 1)]
    // Running down the outline, outward lies to its left in the radius and height plane.
    const [dr, dy] = [toRadius - fromRadius, toY - fromY]
    const length = Math.hypot(dr, dy)
    return [radius - dy / length * distance, y + dr / length * distance] as const
  })
}
/**
 * A funnel turned round the y axis out of sheet metal `thickness` thick: its inside follows `inside` from its rim at the top down to the lower end of its throat, its outside the same outline that far further out, and its rim is either rolled over into a bead or turned out flat into a flange `rim` meters wide, like a sink’s lying on the top it is let into.
 * Its `collision` is the inside alone, which whatever drops into it rolls down.
 */
export default class FunnelGeometry {
  readonly collision: LatheGeometry
  readonly metal: BufferGeometry

  constructor(inside: ReadonlyArray<FunnelPoint>, thickness: number, rim: 'rolled' | number) {
    if (inside.length < 2 || inside.some(([radius], index) => !(radius > 0) || index && inside[index - 1][1] < inside[index][1])) {
      throw new RangeError('A funnel’s inside runs down from its rim, never up, all round its axis.')
    }
    const outside = offsetOutline(inside, thickness)
    const [rimRadius, rimY] = inside[0]
    const parts: Array<BufferGeometry> = [
      // down the inside from the rim, so it faces up and in
      lathe(inside),
      // up the outside to the rim, so it faces out and down, from round the lower end of the throat
      lathe([inside.at(-1)!, ...outside.toReversed()]),
    ]
    if (rim === 'rolled') {
      const bead = new TorusGeometry(rimRadius + thickness / 2, thickness * 1.2, 8, segments)
      parts.push(bead.rotateX(Math.PI / 2).translate(0, rimY, 0))
    } else {
      // over the top of the outside, out flat and back in under itself
      parts.push(lathe([[rimRadius + rim, rimY - thickness], [rimRadius + rim, rimY], [rimRadius, rimY]]), lathe([outside[0], [rimRadius + rim, rimY - thickness]]))
    }
    this.metal = mergeParts(parts)
    this.collision = lathe(inside)
  }

  dispose() {
    this.metal.dispose()
    this.collision.dispose()
  }
}
