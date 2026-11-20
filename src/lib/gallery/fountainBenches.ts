import type {Vec3} from './types.ts'

import {lobbyFountainSpot} from './lobbyFountain.ts'

export const fountainBench = {
  width: 2.8,
  depth: 0.8,
  height: 0.5,
  radius: 4,
  slats: 6,
  slatGap: 0.025,
  /** how thick the teak battens are */
  thickness: 0.085,
  /** how heavy a whole bench is, in kilograms */
  mass: 130,
} as const

/** Two bent round-tube frames under each seat, aligned with the slat fasteners. */
export const fountainBenchFrame = {
  centers: [-1.04, 1.04],
  radius: 0.035,
  bendRadius: 0.08,
  halfDepth: fountainBench.depth / 2 - 0.075,
  topY: fountainBench.height - 0.1,
} as const

/** which side of the fountain each bench stands on, in the order of {@link fountainBenches} */
const benchSides = ['south', 'east', 'north', 'west'] as const

/** One bench on each side of the fountain, facing it, each a body of its own, named after its side. */
export const fountainBenches = benchSides.map((side, i) => {
  const angle = i * Math.PI / 2
  return {
    name: `lobby-bench-${side}`,
    position: [lobbyFountainSpot[0] + Math.sin(angle) * fountainBench.radius, lobbyFountainSpot[1], lobbyFountainSpot[2] + Math.cos(angle) * fountainBench.radius] as Vec3,
    rotation: [0, angle, 0] as Vec3,
  }
})

/** teak and steel, in kg/m³, and the wall of the frame’s tube, in meters, which share a bench’s mass between its battens and its frames */
const teak = 630
const steel = 7850
const tubeWall = 0.003
/** how many straight pieces a collider follows each bend of a frame’s tube along, which keeps it within 3 mm of the tube */
const bendPieces = 3

/** a straight run of a frame’s tube a collider follows, from end to end, in the bench’s frame, and its share of the bench’s mass, in kilograms */
export type FrameRun = {
  from: Vec3
  /** whether it is a leg, standing on the floor with a flat foot; every other run is round at both ends, where it meets the next */
  leg: boolean
  mass: number
  to: Vec3
}

/**
 * A bench’s colliders in its frame, on the floor under its middle, and how heavy each is, in kilograms: its battens as one slab under the seat and each frame’s tube in straight runs along its centerline, sharing the bench’s mass like the teak in the battens and the steel in the tubes would. The legs run straight up from the floor; the bends follow the tube in a few pieces each.
 */
export function fountainBenchColliders() {
  const {depth, height, slatGap, slats, thickness, width} = fountainBench
  const {bendRadius, centers, halfDepth, radius, topY} = fountainBenchFrame
  const bendY = topY - bendRadius
  const runs: Array<Omit<FrameRun, 'mass'>> = []
  for (const x of centers) {
    for (const side of [-1, 1]) {
      runs.push({
        from: [x, 0, side * halfDepth],
        leg: true,
        to: [x, bendY, side * halfDepth],
      })
      const bendZ = side * (halfDepth - bendRadius)
      const along = (angle: number): Vec3 => [x, bendY + bendRadius * Math.sin(angle), bendZ + side * bendRadius * Math.cos(angle)]
      for (let piece = 0; piece < bendPieces; piece++) {
        runs.push({
          from: along(piece / bendPieces * Math.PI / 2),
          leg: false,
          to: along((piece + 1) / bendPieces * Math.PI / 2),
        })
      }
    }
    runs.push({
      from: [x, topY, -(halfDepth - bendRadius)],
      leg: false,
      to: [x, topY, halfDepth - bendRadius],
    })
  }
  const lengthOf = ({from, to}: Omit<FrameRun, 'mass'>) => Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  /** how heavy a meter of the tube and the battens are, before they are scaled to the bench’s mass */
  const tubeMass = 2 * Math.PI * radius * tubeWall * steel
  const battens = width * thickness * (depth + slatGap - slats * slatGap) * teak
  const scale = fountainBench.mass / (battens + runs.reduce((sum, run) => sum + lengthOf(run) * tubeMass, 0))
  return {
    seat: {
      center: [0, height - thickness / 2, 0] as Vec3,
      size: [width, thickness, depth] as Vec3,
      mass: battens * scale,
    },
    frame: runs.map((run): FrameRun => ({
      ...run,
      mass: lengthOf(run) * tubeMass * scale,
    })),
  }
}
