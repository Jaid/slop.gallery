import type {Vec3} from 'math'

/** Overall dimensions of the knotted stone, including its oval foot. */
export const hitchSize: Vec3 = [2.9, 2.93, 1.63]

export const hitch = {
  foot: {
    bottomRadius: 1.4,
    height: 0.24,
    radialSegments: 48,
    scaleZ: 0.58,
    topRadius: 1.3,
  },
  knot: {
    p: 2,
    q: 3,
    radialSegments: 28,
    radius: 0.86,
    tube: 0.155,
    tubularSegments: 192,
  },
} as const

/** How many masses the continuous loop’s collider splits its weight among. */
export const hitchColliderSegments = 32
/** Depth of the loop embedded in its foot so the two read as one carved piece. */
export const hitchFootOverlap = 0.06
