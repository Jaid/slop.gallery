import type {Wall} from '../placement/wallGeometry.ts'
import type {FloorRectangle} from './floors.ts'
import type {Vec3} from './types.ts'

import {antechamberDomeCrownY} from './antechamberDomeShape.ts'
import {defaultBaseboardHeight, wallFace} from './architectureDimensions.ts'
import lobby from './lobby.ts'
import StairFlight from './stairs/StairFlight.ts'

export type AntechamberSide = 'east' | 'west'

/**
 * The Antechamber’s three-bay plan in world meters: the central domed square behind the Lobby’s south doorway, flanked symmetrically by a west pavilion (opening south into Moonfall’s approach) and an east pavilion (opening east onto the ascending upper-floor stairs), joined through short barrel-vaulted necks.
 *
 * The necks stand 2 m north of the central hall’s middle so that every sightline from anywhere in the Lobby into the west pavilion stops on its west and south walls clear of Moonfall’s south doorway, letting the Lobby drop Moonfall from its activations.
 */
const antechamber = {
  center: [0, 12] as const,
  size: [8, 8] as const,
  height: 7,
  /** length along x and clear width along z of each arched threshold neck */
  neck: {
    length: 2,
    width: lobby.antechamberDoorWidth,
    z: 10,
    /** height of the arch crown above the floor; semicircular springing sits at crown − width / 2 */
    height: 3.6,
    springY: 3.6 - lobby.antechamberDoorWidth / 2,
    /** outer thickness of the barrel vault above its inner face */
    vaultThickness: 0.18,
  },
  /** each flanking pavilion: flush with the Lobby’s south wall at z = 8 and clear of the Sienna’s east wall */
  pavilion: {
    size: [5, 6] as const,
    z: 11,
    height: 5,
    skylight: {
      radius: 1.45,
      drumHeight: 0.68,
      latticeDepth: 0.04,
      glassInset: 0.015,
    },
  },
  /** ascending stairs out of the east pavilion toward the future upper floor, ending on a level landing against a blank wall */
  eastStairs: {
    width: lobby.antechamberDoorWidth,
    z: 11,
    steps: 12,
    rise: 0.18,
    run: 0.4,
    bottomLanding: 0.2,
    topLanding: 1.2,
    // Tall enough that the raking cornice clears the 3.6 m pavilion doorway header cleanly.
    headroom: 4.4,
  },
} as const
const centralHalfX = antechamber.size[0] / 2
const neckOuterX = centralHalfX + antechamber.neck.length
const pavilionHalfX = antechamber.pavilion.size[0] / 2

/** Center of the west or east pavilion in world xz. */
export const antechamberPavilionCenter = (side: AntechamberSide): readonly [number, number] => [
  (side === 'west' ? -1 : 1) * (neckOuterX + pavilionHalfX),
  antechamber.pavilion.z,
]

/** Center of the west or east barrel-vaulted neck in world xz. */
export const antechamberNeckCenter = (side: AntechamberSide): readonly [number, number] => [
  (side === 'west' ? -1 : 1) * (centralHalfX + antechamber.neck.length / 2),
  antechamber.neck.z,
]

/** Height of the pavilions’ skylight crowns above the floor, staying under the Lobby and Vesper cornice height (5.8 m). */
export const antechamberPavilionCrownY = antechamber.pavilion.height + 0.07 + antechamber.pavilion.skylight.drumHeight

/** Both flanking pavilions as world floor rectangles. */
export const antechamberPavilions = (['west', 'east'] as const).map(side => ({
  side,
  center: antechamberPavilionCenter(side),
  size: antechamber.pavilion.size,
  height: antechamber.pavilion.height,
  crownY: antechamberPavilionCrownY,
}))

/** Both arched threshold necks as world floor rectangles. */
export const antechamberNecks = (['west', 'east'] as const).map(side => ({
  side,
  center: antechamberNeckCenter(side),
  size: [antechamber.neck.length, antechamber.neck.width] as const,
  height: antechamber.neck.height,
}))

/** World x of the east pavilion’s east doorway, where the ascending flight starts. */
const eastStairsStartX = neckOuterX + antechamber.pavilion.size[0]
const eastFlightRun = antechamber.eastStairs.bottomLanding + antechamber.eastStairs.steps * antechamber.eastStairs.run
const eastStairsTopX = eastStairsStartX + eastFlightRun
const eastStairsTopY = antechamber.eastStairs.steps * antechamber.eastStairs.rise
const eastStairsEndX = eastStairsTopX + antechamber.eastStairs.topLanding

/** The ascending flight out of the east pavilion, modeled as a StairFlight descending from its top landing back to the pavilion floor. */
export const antechamberEastFlight = new StairFlight(
  'east',
  [eastStairsTopX, eastStairsTopY, antechamber.eastStairs.z],
  [eastStairsStartX, 0, antechamber.eastStairs.z],
  antechamber.eastStairs.width,
  antechamber.eastStairs.steps,
  0,
  antechamber.eastStairs.bottomLanding,
  'antechamber',
  antechamber.eastStairs.headroom,
)

/** Level top landing at the head of the east stairs, closed by a blank wall. */
export const antechamberEastLanding = {
  center: [(eastStairsTopX + eastStairsEndX) / 2, antechamber.eastStairs.z] as const,
  size: [antechamber.eastStairs.topLanding, antechamber.eastStairs.width] as const,
  floorY: eastStairsTopY,
  height: antechamber.eastStairs.headroom,
  endX: eastStairsEndX,
  startX: eastStairsTopX,
} as const

/** Sloped roof beam over the east ascending flight. */
export const antechamberEastRoof = antechamberEastFlight.beam(antechamber.eastStairs.headroom, 0.18, antechamberEastFlight.width)

/** World x and z where the west pavilion opens south into Moonfall’s curved approach. */
export const antechamberMoonfallDoor = {
  x: antechamberPavilionCenter('west')[0],
  z: antechamber.pavilion.z + antechamber.pavilion.size[1] / 2,
  width: lobby.antechamberDoorWidth,
  height: 3.6,
} as const

/** World walls of the east ascending staircase and its level top landing. */
export function antechamberEastStairWalls(): Array<Wall> {
  const {center: [landingX, landingZ], floorY, height, size: [landingLen, landingWidth], endX} = antechamberEastLanding
  const wallHeight = height - 0.3
  // Slim skirting on the top landing so no bulky baseboard block overhangs the top riser while still mitering cleanly at the landing corners.
  const landingSkirting = [
    [wallFace + 0.035, 0],
    [wallFace + 0.035, defaultBaseboardHeight],
    [wallFace, defaultBaseboardHeight],
  ] as const
  return [
    antechamberEastFlight.wall(-1),
    antechamberEastFlight.wall(1),
    {
      id: 'antechamber-stairs_east_landing_north',
      room: 'antechamber',
      center: [landingX, floorY, landingZ - landingWidth / 2],
      rotation: 0,
      width: landingLen,
      height: wallHeight,
      baseboardSection: landingSkirting,
      sticky: false,
    },
    {
      id: 'antechamber-stairs_east_landing_south',
      room: 'antechamber',
      center: [landingX, floorY, landingZ + landingWidth / 2],
      rotation: Math.PI,
      width: landingLen,
      height: wallHeight,
      baseboardSection: landingSkirting,
      sticky: false,
    },
    {
      id: 'antechamber-stairs_east_end',
      room: 'antechamber',
      center: [endX, floorY, landingZ],
      rotation: -Math.PI / 2,
      width: landingWidth,
      height: wallHeight,
      baseboardSection: landingSkirting,
      sticky: false,
    },
  ]
}

/** World walls lining the straight jambs of both barrel-vaulted necks, flush with the arch reveals. */
export function antechamberNeckWalls(): Array<Wall> {
  const {length, springY, width} = antechamber.neck
  return antechamberNecks.flatMap(({side, center: [x, z]}) => [
    {
      id: `antechamber-${side}_neck_north`,
      room: 'antechamber',
      center: [x, 0, z - width / 2 - wallFace],
      rotation: 0,
      width: length,
      height: springY - 0.3,
      trimStyle: 'none' as const,
      sticky: false,
    },
    {
      id: `antechamber-${side}_neck_south`,
      room: 'antechamber',
      center: [x, 0, z + width / 2 + wallFace],
      rotation: Math.PI,
      width: length,
      height: springY - 0.3,
      trimStyle: 'none' as const,
      sticky: false,
    },
  ])
}

const inRect = ({center: [cx, cz], size: [w, d]}: FloorRectangle, x: number, z: number) => Math.abs(x - cx) <= w / 2 + 1e-6 && Math.abs(z - cz) <= d / 2 + 1e-6

/** Floor height anywhere in the Antechamber outside its central 8 × 8 m square: its necks, pavilions, east ascending stairs and top landing. */
export function antechamberAnnexFloor(x: number, z: number): number | undefined {
  for (const pavilion of antechamberPavilions) {
    if (inRect(pavilion, x, z)) {
      return 0
    }
  }
  for (const neck of antechamberNecks) {
    if (inRect(neck, x, z)) {
      return 0
    }
  }
  if (inRect(antechamberEastLanding, x, z)) {
    return antechamberEastLanding.floorY
  }
  return antechamberEastFlight.floorAt(x, z)
}

/** Clear ceiling height above world `(x, z)` inside any Antechamber bay or annex, or undefined outside it. */
export function antechamberCeilingAt(x: number, z: number): number | undefined {
  if (inRect(antechamber, x, z)) {
    return antechamberDomeCrownY
  }
  for (const pavilion of antechamberPavilions) {
    if (inRect(pavilion, x, z)) {
      return pavilion.crownY
    }
  }
  for (const neck of antechamberNecks) {
    if (inRect(neck, x, z)) {
      return neck.height
    }
  }
  if (inRect(antechamberEastLanding, x, z)) {
    return antechamberEastLanding.floorY + antechamberEastLanding.height
  }
  const stairFloor = antechamberEastFlight.floorAt(x, z)
  if (stairFloor !== undefined) {
    return stairFloor + antechamber.eastStairs.headroom
  }
}

/** Whether `[x, y, z]` lies inside any Antechamber annex (necks, pavilions, east stairs or top landing). */
export function insideAntechamberAnnex([x, y, z]: Vec3): boolean {
  const floor = antechamberAnnexFloor(x, z)
  if (floor === undefined) {
    return false
  }
  const ceiling = antechamberCeilingAt(x, z)!
  return y >= floor - 1 && y <= ceiling + 0.2
}

export default antechamber
