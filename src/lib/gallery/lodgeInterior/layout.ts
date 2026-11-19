import type {Vec3} from '../types.ts'

import lodge, {lodgeBay} from '../lodge.ts'
import UpholsteredSeatGeometry from './UpholsteredSeatGeometry.ts'

/** The bay’s mouth in the room’s frame. */
const bayMouthZ = lodgeBay.corners[0][1] - lodge.center[1]
/** The beams cross the room in even bays from the header across the bay’s mouth to the south wall, which takes none. */
const beamSpacing = lodge.size[1] / 3

export type Placement = {
  position: Vec3
  /** turn around y in radians */
  yaw: number
}
/** `position` is the point on the floor under the volume’s middle. */
export type FurnitureCollider = Placement & {
  name: string
  size: Vec3
}

const seatWidth = 0.68
const sofa = {
  position: [0, 0, -0.5] as Vec3,
  yaw: 0,
  seats: 3,
}
/** angled toward the fire, framing the hearth */
const armchairs: ReadonlyArray<Placement> = [
  {
    position: [2.2, 0, 1.6],
    yaw: -1.15,
  },
  {
    position: [-2.2, 0, 1.6],
    yaw: 1.15,
  },
]
/**
 * Furnishings of the Lodge in the room’s frame: the origin is the middle of the floor and +z points toward the fireplace on the south wall.
 *
 * Seating gathers around the hearth and keeps clear of the walkway from the tunnel’s doorway at z −2.7 through the north bay to the Corridor’s doorway in its back wall.
 */
const lodgeInterior = {
  /** north edge of the furniture; the walkway between the doorways stays free north of it */
  walkwayEdge: -1.45,
  /** a flat-woven kilim, centered in front of the fire */
  rug: {
    position: [0, 0, 0.75] as Vec3,
    size: [3.6, 2.6] as [number, number],
    thickness: 0.012,
  },
  sofa,
  seatWidth,
  armchairs,
  /** how much wider than a seat of the sofa an armchair’s is */
  armchairSpread: 0.08,
  /**
   * The fieldstone chimney breast on the south wall. Lengths are along the room’s z; the fireplace group itself is turned by 180°, so its frame uses the negated values.
   *
   * The hearth is 0.2 m high; a raised stone bed lifts the fire inside the 2.3 m opening. A deeper breast and hearth accommodate a gently bowed iron guard.
   */
  fireplace: {
    hearth: {
      size: [4.2, 0.2, 1.65] as Vec3,
      z: 4.175,
    },
    /** A new stone step inside the firebox: its top supports both the fire and the guard's feet. */
    raisedBed: {
      size: [2.3, 0.24, 1.24] as Vec3,
      z: 4.01,
    },
    /** Wrought-iron fire screen, standing on the raised bed and curving toward the room. */
    guard: {
      width: 2.12,
      bars: 7,
      footZ: -3.6,
      top: 1.72,
      bow: 0.16,
    },
    /** front face of the breast and its pillars */
    front: 3.65,
    /** depth of the breast from the wall */
    depth: 1.3,
    width: 3.6,
    openingHalfWidth: 1.15,
    /** underside of the stone lintel above the firebox */
    opening: 1.9,
    lintelHeight: 0.38,
    mantel: {
      size: [4, 0.2, 0.44] as Vec3,
      /** how far the mantel stands proud of the breast */
      overhang: 0.2,
    },
    /** the narrower chimney stack from the mantel up to the ceiling */
    chimney: {
      width: 3,
      depth: 0.77,
    },
    /** soot-black lining at the back of the firebox */
    back: 4.67,
  },
  /** hewn beams across the room, resting on the east and west walls; the first is the header across the bay’s mouth, from corner to corner */
  beams: {
    z: [bayMouthZ, bayMouthZ + beamSpacing, bayMouthZ + beamSpacing * 2],
    /** width and height of each beam */
    size: [0.3, 0.34] as [number, number],
  },
} as const

/** Solid volumes of the furniture for the physics world, in the room’s frame. */
export function lodgeFurnitureColliders(): Array<FurnitureCollider> {
  const {depth, backHeight, armWidth} = UpholsteredSeatGeometry
  const seat = (seats: number): Vec3 => [seats * seatWidth + armWidth * 2, backHeight, depth]
  return [
    {
      name: 'lodge-sofa',
      ...sofa,
      size: seat(sofa.seats),
    },
    ...armchairs.map((placement, index) => ({
      name: `lodge-armchair-${index}`,
      ...placement,
      size: seat(1),
    })),
  ]
}

/** An iron hook centered on the room-facing side of the fireplace’s right-hand pillar. */
export const lodgeHatchetHook = {
  /** In the Lodge’s local frame, with the plate inset slightly into the stone face. */
  position: [-(lodgeInterior.fireplace.width / 2 + lodgeInterior.fireplace.openingHalfWidth) / 2, 1.6, lodgeInterior.fireplace.front - 0.018] as Vec3,
  /** The hatchet’s origin: its leather loop rests in the end of the forward-curved hook. */
  hatchetOffset: [0, -0.12, -0.205] as Vec3,
} as const

export default lodgeInterior
