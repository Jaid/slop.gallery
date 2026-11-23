import type {Vec3} from './types.ts'

import {antechamberDomeCrownY} from './antechamberDomeShape.ts'
import {floorThickness, groundFenceY} from './floors.ts'
import lobby from './lobby.ts'
import {balconyDoor} from './lobbyBalcony.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight from './stairs/StairFlight.ts'

/** An axis-aligned piece of the Antechamber in world meters, with a floor and ceiling of its own. */
function planBay(west: number, east: number, north: number, south: number, floorY: number, ceiling: number) {
  const center = [(west + east) / 2, (north + south) / 2] as const
  const size = [east - west, south - north] as const
  return {
    west,
    east,
    north,
    south,
    floorY,
    ceiling,
    center,
    size,
  }
}

export const antechamber = planBay(-4, 4, lobby.southZ, lobby.southZ + 8, 0, antechamberDomeCrownY)
export const antechamberWings = {
  west: planBay(-10, antechamber.west, 8.65, 16.6, 0, 4.5),
  east: planBay(antechamber.east, 10, 8.65, 15.8, 0, 4.02),
}
export const wingArches = {
  west: {
    z: 10.35,
    width: 2.3,
    height: 3.45,
  },
  east: {
    z: 12.2,
    width: 2.6,
    height: 3.45,
  },
}

/** The west wing’s south door leads around a blind elbow. The floor stays level until it is clear of Moonfall’s raised ceiling. */
export const moonfallApproach = {
  x: -6.05,
  z: 19.6,
  width: 2.6,
  ceiling: 3.55,
  endX: lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2 + 0.75,
}
const approachWest = moonfallApproach.x - moonfallApproach.width / 2
const approachEast = moonfallApproach.x + moonfallApproach.width / 2
const approachNorth = moonfallApproach.z - moonfallApproach.width / 2
const approachSouth = moonfallApproach.z + moonfallApproach.width / 2
export const moonfallApproachBays = {
  stem: planBay(approachWest, approachEast, antechamberWings.west.south, approachNorth, 0, moonfallApproach.ceiling),
  hall: planBay(approachWest, moonfallApproach.endX, approachNorth, approachSouth, 0, moonfallApproach.ceiling),
}

const upperY = balconyDoor.bottom
const upperCeiling = 7.9
const gallerySouth = 11.65
const upperStairX = 20.25
const upperStairZ = 13.65
const upperStairWidth = 2.7
const galleryNorth = 8.45
export const upperGallery = {
  threshold: planBay(4.4, 7.5, lobby.southZ, galleryNorth, upperY, upperCeiling),
  hall: planBay(4.4, 27, galleryNorth, gallerySouth, upperY, upperCeiling),
  landing: planBay(upperStairX, 23.65, gallerySouth, upperStairZ + upperStairWidth / 2, upperY, upperCeiling),
}
// StairFlight runs from high to low; the 1.2 m landing at the foot keeps the east arch clear.
export const upperGalleryStair = new StairFlight('gallery', [upperStairX, upperY, upperStairZ], [antechamberWings.east.east, 0, upperStairZ], upperStairWidth, 24, 0, 1.2, 'antechamber', 3.6)
export const antechamberAnnexes = [...Object.values(antechamberWings), ...Object.values(moonfallApproachBays), ...Object.values(upperGallery)]

/** The level slabs and the steps outside the central hall. */
export function antechamberFloor(x: number, z: number) {
  const floors = antechamberAnnexes.filter(bay => x >= bay.west && x <= bay.east && z >= bay.north && z <= bay.south).map(bay => bay.floorY)
  return [...floors, upperGalleryStair.floorAt(x, z)].filter(y => y !== undefined)
}

export function insideAntechamber([x, y, z]: Vec3) {
  return [antechamber, ...antechamberAnnexes].some(bay => x >= bay.west && x <= bay.east && z >= bay.north && z <= bay.south && y >= bay.floorY - 1 && y <= bay.ceiling + 0.2) || upperGalleryStair.contains([x, y, z])
}

/** Match the cut between the ground floor and Moonfall; elevated decks have their own slab. */
export const antechamberFenceFloor = (y: number) => (y === 0 ? groundFenceY : y - floorThickness)
