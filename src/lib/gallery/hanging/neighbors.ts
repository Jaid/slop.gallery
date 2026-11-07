import type {Vec3} from 'math'

import {heft} from './motion.ts'

/** how far apart the edges of two works on the same wall may be, in meters, for the blow of one slapped onto it to still reach the other, barely */
export const neighborReach = 8
/** how hard the blow reaches a work {@link neighborReach} away, against one right beside */
const faintest = 0.12

/** a work hanging near one slapped onto the same wall, with how far apart their edges are in meters and how hard the blow reaches it, as the strength of its jolt */
export type HangingNeighbor<Work extends Hung> = {
  gap: number
  strength: number
  work: Work
}

type Hung = {
  fusing?: boolean
  height: number
  hung: boolean
  id: string
  position: Vec3
  reserved?: boolean
  rotation: number
  width: number
}

/**
 * The works hanging still on the same wall as `work`, facing the same way within a hair and no more than 8 cm in front of or behind it, their edges within {@link neighborReach} of its own, the closest first.
 * The blow reaches a work right beside at full strength, falling off linearly to a faint one at reach, all of it harder the heavier `work` is.
 */
export function hangingNeighbors<Work extends Hung>(work: Pick<Hung, 'height' | 'id' | 'position' | 'rotation' | 'width'>, works: Iterable<Work>): Array<HangingNeighbor<Work>> {
  const normal = [Math.sin(work.rotation), Math.cos(work.rotation)]
  const blow = heft({
    halfHeight: work.height / 2,
    halfWidth: work.width / 2,
  }) ** (1 / 3)
  const neighbors: Array<HangingNeighbor<Work>> = []
  for (const other of works) {
    if (other.id === work.id || !other.hung || other.fusing || other.reserved) {
      continue
    }
    const turned = Math.atan2(Math.sin(other.rotation - work.rotation), Math.cos(other.rotation - work.rotation))
    if (Math.abs(turned) > 0.02) {
      continue
    }
    const [dx, dy, dz] = [0, 1, 2].map(axis => other.position[axis] - work.position[axis])
    const out = dx * normal[0] + dz * normal[1]
    const along = dx * normal[1] - dz * normal[0]
    const gap = Math.hypot(Math.max(0, Math.abs(along) - (work.width + other.width) / 2), Math.max(0, Math.abs(dy) - (work.height + other.height) / 2))
    if (Math.abs(out) > 0.08 || gap > neighborReach) {
      continue
    }
    neighbors.push({
      gap,
      strength: blow * (1 - (1 - faintest) * gap / neighborReach),
      work: other,
    })
  }
  return neighbors.toSorted((a, b) => a.gap - b.gap)
}
