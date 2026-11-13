import type {FloorPolygon} from './floorPolygons.ts'
import type {Vec3} from './types.ts'

import {insidePolygon} from './floorPolygons.ts'
import {floorThickness, subtractFloorOpening} from './floors.ts'
import lobby from './lobby.ts'

const moonfallFloorY = -8
export const oculusDrop = 3
const oculusNorthZ = lobby.opening.center[1] - 11
// Extend toward Moonfall; the connecting tunnel takes up whatever is left.
const oculusSouthZ = lobby.opening.center[1] + 9
/** how far the balcony along the south wall reaches into the Oculus, from the wall’s centerline */
export const oculusBalconyDepth = 3
/** the radius of the round tower in the middle of the Oculus */
export const oculusTowerRadius = 2.2
const lowerGallery = {
  floorY: moonfallFloorY,
  moonfall: {
    // Keep the north tunnel fixed; expand west and south. The stairs arrive in the middle of the east wall.
    center: [-8, 18.5],
    size: [28, 28],
  },
  oculus: {
    floorY: moonfallFloorY - oculusDrop,
    center: [lobby.opening.center[0], (oculusNorthZ + oculusSouthZ) / 2],
    size: [18, oculusSouthZ - oculusNorthZ],
    ceiling: {
      topY: -floorThickness,
      thickness: 0.18,
    },
  },
  tunnel: {
    northX: lobby.opening.center[0],
    southX: -8,
    northZ: oculusSouthZ,
    southZ: 4.5,
    northBendZ: -13.5,
    southBendZ: 1.5,
    northY: moonfallFloorY - oculusDrop,
    southY: moonfallFloorY,
    // as wide as the Oculus tower
    width: oculusTowerRadius * 2,
    height: 3.6,
  },
} as const

export type TunnelSegment = {
  end: Point
  heading: Point
  id: 'diagonal' | 'north' | 'south'
  length: number
  polygon: FloorPolygon
  /** unit vector pointing toward the west side (to the right when walking south) */
  right: Point
  start: Point
}
type Point = readonly [number, number]

const {tunnel} = lowerGallery
const northLen = tunnel.northBendZ - tunnel.northZ
const diagDx = tunnel.southX - tunnel.northX
const diagDz = tunnel.southBendZ - tunnel.northBendZ
const diagLen = Math.hypot(diagDx, diagDz)
const southLen = tunnel.southZ - tunnel.southBendZ
const diagHeading: Point = [diagDx / diagLen, diagDz / diagLen]
const diagEast: Point = [diagHeading[1], -diagHeading[0]]
const halfWidth = tunnel.width / 2
/** miter offset along each segment at both beveled turns: halfWidth · tan(θ / 2) */
export const tunnelMiter = halfWidth * Math.abs(diagHeading[0]) / (1 + diagHeading[1])
/** Both beveled turns (plus a 25 cm stub past each inner corner so level baseboards and cornices miter cleanly) lie flat at their room’s elevation; the diagonal stretch between them slopes evenly from −11 m to −8 m. */
const tunnelLevelStub = 0.25
export const tunnelSlopeStartS = tunnelMiter + tunnelLevelStub
export const tunnelSlopeEndS = diagLen - tunnelMiter - tunnelLevelStub
export const tunnelSlopeLength = tunnelSlopeEndS - tunnelSlopeStartS
export const tunnelSlope = (tunnel.southY - tunnel.northY) / tunnelSlopeLength
export const tunnelDiagonalYaw = Math.atan2(diagDx, diagDz)
export const tunnelDiagonalHeading = diagHeading
export const tunnelDiagonalEast = diagEast

const p0: Point = [tunnel.northX, tunnel.northZ]
const p1: Point = [tunnel.northX, tunnel.northBendZ]
const p2: Point = [tunnel.southX, tunnel.southBendZ]
const p3: Point = [tunnel.southX, tunnel.southZ]
/** West (right) and east (left) boundary vertices of the passage centerline mitered at both turns, north to south. */
export const tunnelBoundary: {
  east: ReadonlyArray<Point>
  west: ReadonlyArray<Point>
} = {
  west: [
    [p0[0] - halfWidth, p0[1]],
    [p1[0] - halfWidth, p1[1] - tunnelMiter],
    [p2[0] - halfWidth, p2[1] - tunnelMiter],
    [p3[0] - halfWidth, p3[1]],
  ],
  east: [
    [p0[0] + halfWidth, p0[1]],
    [p1[0] + halfWidth, p1[1] + tunnelMiter],
    [p2[0] + halfWidth, p2[1] + tunnelMiter],
    [p3[0] + halfWidth, p3[1]],
  ],
}

export const tunnelSegments: ReadonlyArray<TunnelSegment> = [
  {
    id: 'north',
    start: p0,
    end: p1,
    length: northLen,
    heading: [0, 1],
    right: [-1, 0],
    polygon: [tunnelBoundary.west[0], tunnelBoundary.west[1], tunnelBoundary.east[1], tunnelBoundary.east[0]],
  },
  {
    id: 'diagonal',
    start: p1,
    end: p2,
    length: diagLen,
    heading: diagHeading,
    right: [-diagEast[0], -diagEast[1]],
    polygon: [tunnelBoundary.west[1], tunnelBoundary.west[2], tunnelBoundary.east[2], tunnelBoundary.east[1]],
  },
  {
    id: 'south',
    start: p2,
    end: p3,
    length: southLen,
    heading: [0, 1],
    right: [-1, 0],
    polygon: [tunnelBoundary.west[2], tunnelBoundary.west[3], tunnelBoundary.east[3], tunnelBoundary.east[2]],
  },
]

/** Point in world xz along the diagonal segment (`s` meters south-west of its north bend, `across` meters east-southeast of its centerline). */
export function tunnelDiagonalPoint(s: number, across = 0): Point {
  return [p1[0] + s * diagHeading[0] + across * diagEast[0], p1[1] + s * diagHeading[1] + across * diagEast[1]]
}

/** Floor elevation `s` meters along the diagonal segment from its north bend: flat across both beveled elbows, sloping smoothly in between. */
export function tunnelDiagonalFloorY(s: number) {
  if (s <= tunnelSlopeStartS) {
    return tunnel.northY
  }
  if (s >= tunnelSlopeEndS) {
    return tunnel.southY
  }
  return tunnel.northY + (s - tunnelSlopeStartS) * tunnelSlope
}

/** Floor elevation under `(x, z)` inside the Exhibition passage, or undefined outside it. */
export function tunnelFloorHeight(x: number, z: number) {
  for (const segment of tunnelSegments) {
    if (!insidePolygon(segment.polygon, x, z)) {
      continue
    }
    if (segment.id === 'north') {
      return tunnel.northY
    }
    if (segment.id === 'south') {
      return tunnel.southY
    }
    const s = (x - p1[0]) * diagHeading[0] + (z - p1[1]) * diagHeading[1]
    return tunnelDiagonalFloorY(s)
  }
}

/** Whether `[x, y, z]` lies inside the Exhibition passage’s floor-to-ceiling volume. */
export function tunnelContains([x, y, z]: Vec3) {
  const floor = tunnelFloorHeight(x, z)
  return floor !== undefined && y >= floor - 1 && y <= floor + tunnel.height
}

const tunnelMidpoint = tunnelDiagonalPoint(diagLen / 2)
/** the middle of the tunnel’s sloping floor, halfway along its diagonal display gallery */
export const tunnelCenter: Vec3 = [tunnelMidpoint[0], tunnelDiagonalFloorY(diagLen / 2), tunnelMidpoint[1]]

export const oculusCeiling = subtractFloorOpening({
  center: [0, 0],
  size: lowerGallery.oculus.size,
}, {
  center: [lobby.opening.center[0] - lowerGallery.oculus.center[0], lobby.opening.center[1] - lowerGallery.oculus.center[1]],
  size: lobby.opening.size,
})

// A meter under the Lodge’s floor, so the side ramps climb gently and the tower’s ramp still rises a meter and a half to its deck.
const platformTopY = moonfallFloorY + 2
const platformHeight = platformTopY - lowerGallery.oculus.floorY
// measured from the side walls’ north ends, where the apse begins; the platform fills the apse behind it too
const platformDepth = 4
/** the platform along the north end, as a box from the side walls’ north ends; the apse behind it is level with its top */
export const oculusPlatform: {
  position: Vec3
  size: Vec3
} = {
  position: [lowerGallery.oculus.center[0], lowerGallery.oculus.floorY + platformHeight / 2, oculusNorthZ + platformDepth / 2],
  size: [lowerGallery.oculus.size[0], platformHeight, platformDepth],
}

// The original wall-side flights keep their elevations. Parallel lower flights run in the opposite direction, turning on a full-width landing.
export const oculusRamps = (['west', 'east'] as const).map(side => ({
  side,
  x: lowerGallery.oculus.center[0] + (side === 'west' ? -1 : 1) * (lowerGallery.oculus.size[0] / 2 - 1.1),
  startZ: oculusPlatform.position[2] + oculusPlatform.size[2] / 2 + 9,
  floorY: moonfallFloorY,
  width: 2.2,
  rise: platformTopY - moonfallFloorY,
  run: 9,
  direction: -1,
  railHeight: 1,
}))
/** how far the short flight from the room’s center runs toward the quarter landing */
const cornerRun = 1.8
// The lower flights start on a quarter landing against the platform’s face, reached by a short flight from the room’s center.
// Both share one slope, so the whole climb to the turning landing feels even.
export const oculusLowerRamps = oculusRamps.map(ramp => {
  const startZ = oculusPlatform.position[2] + oculusPlatform.size[2] / 2 + ramp.width
  const run = ramp.startZ - startZ
  const slope = oculusDrop / (run + cornerRun)
  return {
    ...ramp,
    x: ramp.x + (ramp.side === 'west' ? 1 : -1) * ramp.width,
    startZ,
    run,
    floorY: lowerGallery.oculus.floorY + slope * cornerRun,
    rise: slope * run,
    direction: 1,
  }
})
export const oculusRampFlights = [...oculusRamps, ...oculusLowerRamps]
/** Runs along x, rising from its foot toward the side wall. */
export const oculusCornerRamps = oculusLowerRamps.map(ramp => {
  const towardCenter = ramp.side === 'west' ? 1 : -1
  return {
    side: ramp.side,
    z: ramp.startZ - ramp.width / 2,
    startX: ramp.x + towardCenter * (ramp.width / 2 + cornerRun),
    direction: -towardCenter,
    run: cornerRun,
    width: ramp.width,
    floorY: lowerGallery.oculus.floorY,
    rise: ramp.floorY - lowerGallery.oculus.floorY,
    railHeight: ramp.railHeight,
  }
})
export const oculusQuarterLandings = oculusLowerRamps.map(ramp => ({
  side: ramp.side,
  position: [ramp.x, (lowerGallery.oculus.floorY + ramp.floorY) / 2, ramp.startZ - ramp.width / 2] as Vec3,
  size: [ramp.width, ramp.floorY - lowerGallery.oculus.floorY, ramp.width] as Vec3,
}))
/** how far the turning landing reaches south past the flights, leaving a gap before the balcony */
const rampLandingDepth = 4
// The open corner is rounded by one flight width.
export const oculusRampLandings = oculusRamps.map(ramp => {
  const depth = rampLandingDepth
  return {
    side: ramp.side,
    position: [ramp.x + (ramp.side === 'west' ? 1 : -1) * ramp.width / 2, lowerGallery.oculus.floorY + oculusDrop / 2, ramp.startZ + depth / 2] as Vec3,
    size: [ramp.width * 2, oculusDrop, depth] as Vec3,
    cornerRadius: ramp.width,
  }
})
type RampLanding = typeof oculusRampLandings[number]

/** The rounded corner sits on the room side, toward the tunnel. */
export function rampLandingCorner({side, position, size, cornerRadius}: RampLanding) {
  const sign = side === 'west' ? 1 : -1
  return {
    x: position[0] + sign * (size[0] / 2 - cornerRadius),
    z: position[2] + size[2] / 2 - cornerRadius,
    sign,
  }
}

/** A can-shaped plinth stands behind each turning landing, equally far from its south edge, the south wall and the side wall. */
export const oculusLandingPlinths = oculusRampLandings.map(landing => {
  const sign = landing.side === 'west' ? -1 : 1
  const radius = 0.6
  const height = 1.2
  const wallX = landing.position[0] + sign * landing.size[0] / 2
  const northZ = landing.position[2] + landing.size[2] / 2
  return {
    side: landing.side,
    // as far from the side wall as from the landing and the south wall
    position: [wallX - sign * (oculusSouthZ - northZ) / 2, lowerGallery.oculus.floorY + height / 2, (northZ + oculusSouthZ) / 2] as Vec3,
    radius,
    height,
  }
})

/** Footprint in x/z, starting at the wall-side north corner. */
export function rampLandingOutline(landing: RampLanding, segments = 16) {
  const {position, size, cornerRadius} = landing
  const corner = rampLandingCorner(landing)
  const wallX = position[0] - corner.sign * size[0] / 2
  const northZ = position[2] - size[2] / 2
  const points: Array<[number, number]> = [[wallX, northZ], [position[0] + corner.sign * size[0] / 2, northZ]]
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI / 2
    points.push([corner.x + corner.sign * cornerRadius * Math.cos(angle), corner.z + cornerRadius * Math.sin(angle)])
  }
  points.push([wallX, northZ + size[2]])
  return points
}

export function rampFloorHeight(x: number, z: number) {
  for (const ramp of oculusRampFlights) {
    const distance = (z - ramp.startZ) * ramp.direction
    if (Math.abs(x - ramp.x) <= ramp.width / 2 && distance >= 0 && distance <= ramp.run) {
      return ramp.floorY + distance / ramp.run * ramp.rise
    }
  }
  for (const ramp of oculusCornerRamps) {
    const distance = (x - ramp.startX) * ramp.direction
    if (Math.abs(z - ramp.z) <= ramp.width / 2 && distance >= 0 && distance <= ramp.run) {
      return ramp.floorY + distance / ramp.run * ramp.rise
    }
  }
  const quarter = oculusQuarterLandings.find(({position, size}) => Math.abs(x - position[0]) <= size[0] / 2 && Math.abs(z - position[2]) <= size[2] / 2)
  if (quarter) {
    return quarter.position[1] + quarter.size[1] / 2
  }
  const landing = oculusRampLandings.find(value => rampLandingContains(value, x, z))
  if (landing) {
    return landing.position[1] + landing.size[1] / 2
  }
}

function rampLandingContains(landing: RampLanding, x: number, z: number) {
  const {position, size, cornerRadius} = landing
  if (Math.abs(x - position[0]) > size[0] / 2 || Math.abs(z - position[2]) > size[2] / 2) {
    return false
  }
  const corner = rampLandingCorner(landing)
  if ((x - corner.x) * corner.sign <= 0 || z <= corner.z) {
    return true
  }
  return Math.hypot(x - corner.x, z - corner.z) <= cornerRadius
}

export default lowerGallery
