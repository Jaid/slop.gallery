import type {Vec3} from './types.ts'

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
const moonfall = {
  // The stairs arrive in the middle of the east wall, the tunnel up from the Oculus in the middle of the north wall.
  center: [-8, 18.5],
  size: [28, 28],
} as const
const lowerGallery = {
  floorY: moonfallFloorY,
  moonfall,
  oculus: {
    floorY: moonfallFloorY - oculusDrop,
    center: [lobby.opening.center[0], (oculusNorthZ + oculusSouthZ) / 2],
    size: [18, oculusSouthZ - oculusNorthZ],
    ceiling: {
      topY: -floorThickness,
      thickness: 0.18,
    },
  },
  /** The Exhibition’s tunnel up from the middle of the Oculus’ south wall to the middle of Moonfall’s north wall, see exhibitionTunnel.ts. */
  tunnel: {
    /** the middle of its low end, on the center line of the Oculus’ south wall */
    north: [lobby.opening.center[0], oculusSouthZ],
    /** the middle of its high end, on the center line of Moonfall’s north wall */
    south: [moonfall.center[0], moonfall.center[1] - moonfall.size[1] / 2],
    /** how far either end runs straight out of its room’s wall, measured along its center line to where it turns onto the diagonal between them */
    straight: 1,
    northY: moonfallFloorY - oculusDrop,
    southY: moonfallFloorY,
    // as wide as the Oculus tower
    width: oculusTowerRadius * 2,
    height: 3.6,
  },
} as const

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
