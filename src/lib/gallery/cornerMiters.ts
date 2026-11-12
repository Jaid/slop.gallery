import type {Wall} from '../placement/wallGeometry.ts'

import {baseboardCapHeight, defaultBaseboardHeight, wallFace} from './architectureDimensions.ts'

type Point = readonly [number, number]

/** world xz of a wall’s two ends: its own −x end first */
function wallEnds(wall: Wall): [Point, Point] {
  const [x, , z] = wall.center
  const dx = Math.cos(wall.rotation) * wall.width / 2
  const dz = -Math.sin(wall.rotation) * wall.width / 2
  return [[x - dx, z - dz], [x + dx, z + dz]]
}
/** the direction a wall’s face looks into its room, in world xz */
function inward(wall: Wall): Point {
  return [Math.sin(wall.rotation), Math.cos(wall.rotation)]
}
/** Walls whose trim bands can share a miter: level, straight and with the same profile at the same height. */
function trimKey(wall: Wall) {
  if (wall.trimStyle === 'none' || wall.baseboardProfile || wall.slope || wall.curveRadius) {
    return
  }
  return JSON.stringify([wall.center[1], wall.height, wall.trimStyle ?? 'classic', wall.baseboardHeight ?? defaultBaseboardHeight, wall.baseboardCapHeight ?? baseboardCapHeight, wall.baseboardSection ?? null])
}
const tolerance = 1e-6
/**
 * Marks the wall ends that meet another wall in an inside corner, so `createArchitectureGeometry` miters their baseboards and cornices.
 *
 * Both walls of a corner run their trim to the corner, where the bands would otherwise overlap and share their tops, bottoms and
 * fronts. Mitered along the corner’s bisector, 45° in a right angle, the two bands only touch along the miter.
 * Where either wall is opened down to the floor right at the corner, the baseboards run on square instead: the opened wall’s is all but cut away there, and the other’s runs on into whatever continues past the opening.
 */
export default function miterCorners(walls: ReadonlyArray<Wall>): Array<Wall> {
  // Marks from an earlier pass are recomputed, not kept.
  return walls.map(({miters: _, baseboardMiters: _baseboardMiters, ...wall}, wallIndex) => {
    const key = trimKey(wall)
    if (key === undefined) {
      return wall
    }
    const ends = wallEnds(wall)
    const slants = ends.map((end, index): readonly [band: number, baseboard: number] => {
      // from this end toward the wall’s middle
      const along: Point = [ends[1 - index][0] - end[0], ends[1 - index][1] - end[1]]
      const length = Math.hypot(...along)
      const toward: Point = [along[0] / length, along[1] / length]
      for (const [otherIndex, other] of walls.entries()) {
        if (otherIndex === wallIndex || trimKey(other) !== key) {
          continue
        }
        const otherEnds = wallEnds(other)
        const shared = otherEnds.findIndex(point => Math.hypot(point[0] - end[0], point[1] - end[1]) < tolerance)
        if (shared === -1) {
          continue
        }
        const far = otherEnds[1 - shared]
        const otherLength = Math.hypot(far[0] - end[0], far[1] - end[1])
        const otherToward: Point = [(far[0] - end[0]) / otherLength, (far[1] - end[1]) / otherLength]
        const [nx, nz] = inward(wall)
        const [ox, oz] = inward(other)
        // An inside corner: each wall runs off into the room the other one faces.
        if (otherToward[0] * nx + otherToward[1] * nz > tolerance && toward[0] * ox + toward[1] * oz > tolerance) {
          // The bisector of the angle between both walls leaves the corner this far along the wall per meter into the room.
          const cos = toward[0] * otherToward[0] + toward[1] * otherToward[1]
          const sin = Math.abs(toward[0] * otherToward[1] - toward[1] * otherToward[0])
          // Rounded, so a right angle comes out as exactly 1 and equal walls share one cut.
          const slant = Math.round((1 + cos) / sin * 1e9) / 1e9
          return [slant, openedAt(other, shared === 0 ? -1 : 1) || openedAt(wall, index === 0 ? -1 : 1) ? 0 : slant]
        }
      }
      return [0, 0]
    })
    const miters = [slants[0][0], slants[1][0]] as const
    const baseboardMiters = [slants[0][1], slants[1][1]] as const
    return {
      ...wall,
      ...miters.some(Boolean) ? {miters} : {},
      ...baseboardMiters.some((slant, index) => slant !== miters[index]) ? {baseboardMiters} : {},
    }
  })
}

/** Whether an opening down to the wall’s foot starts within its face’s depth of its end, −1 its −x end and 1 its +x end: there, it cuts away the whole of the wall’s baseboard, mitered or not. */
function openedAt(wall: Wall, end: number) {
  return (wall.holes ?? []).some(hole => !hole.bottom && wall.width / 2 - end * hole.u - hole.width / 2 <= wallFace + tolerance)
}
