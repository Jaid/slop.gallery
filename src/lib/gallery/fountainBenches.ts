import type {Vec3} from './types.ts'

import {lobbyFountainSpot} from './lobbyFountain.ts'

export const fountainBench = {
  width: 2.8,
  depth: 0.8,
  height: 0.5,
  radius: 4,
  slats: 6,
  slatGap: 0.025,
} as const

/** Two bent round-tube frames under each seat, aligned with the slat fasteners. */
export const fountainBenchFrame = {
  centers: [-1.04, 1.04],
  radius: 0.035,
  bendRadius: 0.08,
  halfDepth: fountainBench.depth / 2 - 0.075,
  topY: fountainBench.height - 0.1,
} as const

/** One bench on each side of the fountain, facing it. */
export const fountainBenches = Array.from({length: 4}, (_, i) => {
  const angle = i * Math.PI / 2
  return {
    position: [lobbyFountainSpot[0] + Math.sin(angle) * fountainBench.radius, lobbyFountainSpot[1], lobbyFountainSpot[2] + Math.cos(angle) * fountainBench.radius] as Vec3,
    rotation: [0, angle, 0] as Vec3,
  }
})
