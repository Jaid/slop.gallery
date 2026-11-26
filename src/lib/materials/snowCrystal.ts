import type {Node} from 'three/webgpu'

import {float, select, vec2} from 'three/tsl'

const sin60 = Math.sqrt(3) / 2
const branchAxis = vec2(0.5, sin60)
const branchSide = vec2(-sin60, 0.5)

/** One twelfth of a stellar crystal: x along the nearest of six spines, y toward either of its banks of side branches. No polar singularity at the heart. */
export function crystalSector(point: Node<'vec2'>) {
  const p = point.abs()
  const along = p.dot(branchAxis)
  return select(along.greaterThan(p.x), vec2(along, p.dot(branchSide).abs()), p)
}

/** Inside the stellar plate in a folded sector, with the tip at x = 1. The six little windows between the seed hexagon and its first growth terrace stay open. */
export function stellarPlate(q: Node<'vec2'>) {
  const sideBranch = (root: number, length: number, width: number, feathered = false) => {
    const p = q.sub(vec2(root, 0))
    const rib = blade(p.dot(branchAxis), p.dot(branchSide), length, width)
    if (!feathered) {
      return rib
    }
    // Three finer barbs grow from the windward side of this rib, parallel to the main spine. The nearest row contains the nearest barb.
    const spacing = length / 4
    const row = p.y.div(sin60 * spacing).round().clamp(1, 3)
    const barb = p.sub(branchAxis.mul(row.mul(spacing)))
    const tip = row.mul(-0.016).add(0.134).sub(barb.x).mul(0.35)
    return rib.max(barb.x.min(tip).min(0.012).sub(barb.y.abs()))
  }
  const terminal = q.x.sub(0.83).mul(0.41).min(float(1).sub(q.x).mul(0.54)).sub(q.y)
  return blade(q.x, q.y, 1, 0.044).max(terminal)
    .max(float(0.095).sub(q.x))
    .max(float(0.012).sub(q.x.sub(0.2).abs()))
    .max(sideBranch(0.29, 0.24, 0.027))
    .max(sideBranch(0.46, 0.35, 0.036, true))
    .max(sideBranch(0.65, 0.235, 0.029, true))
    .max(sideBranch(0.82, 0.14, 0.022))
}

/** Signed distance bounds, positive inside a blade of ice with tapering flanks and a pointed tip. */
function blade(along: Node<'float'>, side: Node<'float'>, length: number, width: number) {
  const across = side.abs()
  return along.mul(-0.66 * width / length).add(width).sub(across)
    .min(along.mul(sin60).sub(across.mul(0.5)))
    .min(float(length).sub(along).mul(0.45).sub(across.mul(0.89)))
}
