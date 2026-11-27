import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, float, vec2} from 'three/tsl'

type Float = Node<'float'>

/** the colors of snow and ice: a flake’s bright heart, the cold light it gives off and the deep blue of its shadows */
export const snowColors = {
  bright: hsl.integer(213, 100, 98.5),
  glow: hsl.integer(219, 95, 82),
  shadow: hsl.integer(250, 62, 26),
}
/** how far a side branch leans away from its arm, toward the neighboring arm it grows parallel to, in radians */
const branchAngle = 0.94
const branchRun = [Math.cos(branchAngle), Math.sin(branchAngle)] as const
/**
 * The inside of a stellar snowflake, positive within it, in its own units, which run from −1 to 1 across it with its arm tips at about 0.95: six arms tapering to their points, side branches leaning toward the neighboring arms, smaller barbs off the longest of them and a ringed heart.
 * The point is folded into one twelfth of the flake, a wedge from an arm to the line between two arms, so every part is drawn once and the flake is perfectly sixfold.
 */
export function snowflakeShape(point: Node<'vec2'>): Float {
  const radius = point.length()
  const sector = Math.PI / 3
  // how far the point’s angle stands from the nearest arm, from 0 on an arm to a twelfth of a turn between two arms
  const folded = float(sector / 2).sub(atan(point.y, point.x).mod(sector).sub(sector / 2).abs())
  const wedge = vec2(radius.mul(folded.cos()), radius.mul(folded.sin()))
  // The arm, thick at its foot and tapering to its point.
  const armWidth = float(0.088).sub(wedge.x.clamp(0, 1).mul(0.066))
  let inside = armWidth.sub(segment(wedge, 0, 0, 0.95, 0))
  // Three side branches, the longest nearest the heart, each leaner than the last.
  inside = inside.max(branch(wedge, 0.3, 0.4, 0.046))
  inside = inside.max(branch(wedge, 0.52, 0.31, 0.038))
  inside = inside.max(branch(wedge, 0.7, 0.22, 0.03))
  // Barbs off the longest branch, growing back parallel to the arm, like a fern’s.
  const barbFoot = [0.3 + 0.17 * branchRun[0], 0.17 * branchRun[1]] as const
  inside = inside.max(float(0.024).sub(segment(wedge, barbFoot[0], barbFoot[1], barbFoot[0] + 0.15, barbFoot[1])))
  // The heart: a filled middle inside a ring the arms spring from.
  const heart = float(0.075).sub(radius).max(float(0.04).sub(radius.sub(0.17).abs()))
  return inside.max(heart)
}

/** the distance from `point` to the segment from (`ax`, `ay`) to (`bx`, `by`) */
function segment(point: Node<'vec2'>, ax: number, ay: number, bx: number, by: number): Float {
  const fromA = point.sub(vec2(ax, ay))
  const along = vec2(bx - ax, by - ay)
  const share = fromA.dot(along).div(along.dot(along)).clamp()
  return fromA.sub(along.mul(share)).length()
}
/** the inside of a side branch that sets out from the arm at `from` and reaches `length` far, `width` thick at its foot, in the arm’s own units */
function branch(point: Node<'vec2'>, from: number, length: number, width: number): Float {
  return float(width).sub(segment(point, from, 0, from + length * branchRun[0], length * branchRun[1]))
}
