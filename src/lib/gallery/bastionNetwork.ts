import type {Wall, WallOpening} from '../placement/wallGeometry.ts'
import type {Vec3} from './types.ts'

import {vaultShellThickness, wallFace} from './architectureDimensions.ts'
import {bastionLinkStart, bastionLinkStripZ, bastionLinkWidth, bastionPassages, lodgeSpurEndZ, lodgeSpurHeight, lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from './bastion.ts'
import {cisternFloor, insideCistern} from './cistern/cistern.ts'
import {climbCrossfall, climbHairpin, climbMouth, climbPassages} from './climb.ts'
import gateMouseHole from './gateMouseHole.ts'
import lodge, {lodgeEastWindow} from './lodge.ts'
import FloorHollow from './passages/FloorHollow.ts'
import PassageRoute from './passages/PassageRoute.ts'
import RoutedPassage from './passages/RoutedPassage.ts'
import vaultOpening from './passages/vaultOpening.ts'

const {point: [startX, startZ], heading, y, height} = bastionLinkStart
const mouthNorthZ = climbMouth.path[0][1] - climbMouth.width / 2
/** the radius of the corner from the run south along the Oculus into the strip south of the Lodge */
const cornerRadius = 4
/** the radius of the last turn, from the strip south into the mouth’s north wall at its elbow */
const lastRadius = mouthNorthZ - bastionLinkStripZ
/** where the tunnel ends in the mouth’s north wall: its west wall in line with the mouth’s west wall, so it runs on into the elbow */
const endX = climbMouth.path[1][0] - climbMouth.width / 2 + bastionLinkWidth / 2
/** the opening it ends in through the mouth’s north wall, the size of its vault */
const linkVault = vaultOpening(bastionLinkWidth, height)
const [elbowX, footZ] = climbHairpin.route.start
/** where the mouth’s elbow ends in the west and in the east, along its west wall’s center line and straight across from the corner of its walls inside the turn, where it opens onto the straight run on toward the doorway */
const [elbowWestX, elbowEastX] = [elbowX - climbMouth.width / 2, elbowX + climbMouth.width / 2]
/**
 * How far under the mouth’s floor its elbow’s paving lies at a point in plan: falling toward the line from the middle of the hairpin’s foot to the middle of the tunnel’s mouth, as the hairpin’s does, and as deep there, so it runs on from the hairpin’s paving into the tunnel’s.
 * It falls from the face of the west wall, which runs on into the tunnel’s, and from a wall’s depth short of where the elbow opens east at the hairpin’s foot, from the tunnel’s east jamb at the gate, so the north wall beside it stands on the level floor; level beyond the elbow.
 */
function elbowSag(x: number, z: number) {
  if (z < mouthNorthZ || z > footZ) {
    return 0
  }
  const toGate = (footZ - z) / (footZ - mouthNorthZ)
  const west = elbowWestX + wallFace
  const east = elbowEastX - wallFace + (endX + linkVault.width / 2 - elbowEastX + wallFace) * toGate
  if (x <= west || x >= east) {
    return 0
  }
  const valley = elbowX + (endX - elbowX) * toGate
  const share = x < valley ? (x - west) / (valley - west) : (east - x) / (east - valley)
  return climbCrossfall * (climbMouth.width / 2 - wallFace) * share
}
/**
 * The hollow the elbow’s paving has sunk into in front of the gate, between the hairpin’s foot and the tunnel, as though water had long drained off down the tunnel through the gate’s hatch: deepest just beyond the gate, under the hatch, and shallow over most of the elbow.
 * It keeps off the walls beside the tunnel’s mouth and widens out from the gate into the elbow, so orbs that miss the hatch roll back down to it. Its surface takes the place of the elbow’s whole floor, falling toward its middle like the hairpin’s.
 */
export const climbMouthHollow = new FloorHollow(climbMouth.floorY, {
  center: [endX, mouthNorthZ],
  half: linkVault.width / 2,
  into: [0, -1],
}, {
  depth: 0.15,
  beyond: 0.5,
  reach: 3.5,
  throat: 1.2,
  spread: [1, 1],
  width: [1.5, 1.8],
}, {
  area: {
    center: [elbowX, (mouthNorthZ + footZ) / 2],
    size: [climbMouth.width, footZ - mouthNorthZ],
  },
  sag: elbowSag,
})
/** how far under the mouth’s floor the gate’s foot stands, on the tunnel’s floor, a step under the hollow */
const gateFoot = climbMouthHollow.outletY - climbMouth.floorY
/**
 * The connecting tunnel from the landing south of the curve’s S bend south along the Oculus, round a corner west into the strip south of the Lodge and along it, then round a last turn south into the mouth’s elbow, easing up from the platform’s level all the way to a step under the hollow in front of it, its vault rising to meet the mouth’s ceiling at the gate.
 */
const route = new PassageRoute([startX, startZ], heading, y, height, [
  {
    y: climbMouthHollow.outletY,
    height: climbMouth.height - gateFoot,
    steps: [
      {length: bastionLinkStripZ - cornerRadius - startZ},
      {
        radius: cornerRadius,
        angle: Math.PI / 2,
      },
      {length: startX - cornerRadius - endX - lastRadius},
      {
        radius: lastRadius,
        angle: -Math.PI / 2,
      },
    ],
  },
])
/**
 * How steeply the tunnel’s paving falls from both walls toward its middle: 1 in 20, gentler than the climb’s, so the sill it leaves along the doorway at the landing only slows orbs coming out of it into the crater instead of stopping them short of it.
 */
export const bastionLinkCrossfall = 1 / 20
const lodgeSpurAlong = route.project(lodgeSpurX, bastionLinkStripZ)!.along
const lodgeSpurFloorY = route.at(lodgeSpurAlong).y
const lodgeSpurStartZ = bastionLinkStripZ - bastionLinkWidth / 2
/** Its paving falls toward its middle, but for its last stretch to the gate, where it eases out to stand on a level floor; at the landing, it meets the landing’s floor on a sill along the doorway, a hand’s breadth over its middle. */
export const bastionLink = new RoutedPassage('link', 'bastion', route, bastionLinkWidth, {
  crossfall: {
    slope: bastionLinkCrossfall,
    easeOut: 1.5,
  },
  openings: [{
    ...vaultOpening(lodgeSpurWidth, height),
    name: 'lodge_spur',
    along: lodgeSpurAlong,
    side: 1,
    casing: false,
  }],
})
/** Straight north past the Lodge’s side window, on to the existing passage toward the Lodge, where its closing wall stands back to back with that passage’s left wall. */
const spurRoute = new PassageRoute([lodgeSpurX, lodgeSpurStartZ], -Math.PI / 2, lodgeSpurFloorY, height, [{
  y: lodge.floorY,
  height: lodgeSpurHeight,
  steps: [{length: 2}],
}, {length: lodgeSpurStartZ - lodgeSpurEndZ - 2}])
export const lodgeSpur = new RoutedPassage('lodge-spur', 'bastion', spurRoute, lodgeSpurWidth, {
  fixPavingEdges: false,
  // Cut round the window’s timber reveal, which runs on through the stone and frames it flush with the passage’s face.
  openings: [{
    name: 'lodge_window',
    along: lodgeSpurStartZ - lodgeEastWindow.z,
    side: -1,
    width: lodgeEastWindow.width + lodgeEastWindow.border * 2,
    bottom: lodgeEastWindow.bottom - lodgeEastWindow.sill - lodge.floorY,
    height: lodgeEastWindow.top + lodgeEastWindow.border - lodge.floorY,
    profile: 'rectangle',
    casing: false,
  }],
})
/** the barred window through its closing wall, see `lodgeSpurWindow`, which goes on through the wall behind it */
const spurWindow = {
  name: 'window',
  u: 0,
  width: lodgeSpurWindow.width,
  bottom: lodgeSpurWindow.bottom,
  height: lodgeSpurWindow.height,
  rise: lodgeSpurWindow.rise,
  profile: 'arch',
  casing: false,
} as const satisfies WallOpening
export const lodgeSpurEnd: Wall = {
  id: 'bastion-lodge-spur_end',
  room: 'bastion',
  center: [lodgeSpurX, lodge.floorY, lodgeSpurEndZ],
  rotation: 0,
  width: lodgeSpurWidth,
  height: spurRoute.end.height + vaultShellThickness,
  holes: [spurWindow],
  sticky: false,
  trimStyle: 'plain',
  cornice: false,
}
/** The iron bars in the window through its closing wall, barred like the apse’s windows. In the frame of the closing wall, facing south down the spur. */
export const lodgeSpurGrille = {
  wall: lodgeSpurEnd,
  hole: spurWindow,
  bands: lodgeSpurWindow.bands,
} as const satisfies {
  bands: ReadonlyArray<number>
  hole: WallOpening
  wall: Wall
}
/** where the empty suit of armor stands near the spur’s end, its middle straight across from where the Lodge’s window ends, at the end of its reveal, looking back down the spur toward the link, the barred window behind it, see `suitOfArmor` */
export const lodgeSpurArmor = [lodgeSpurX, lodge.floorY, lodgeEastWindow.z - lodgeEastWindow.width / 2 - lodgeEastWindow.border] as const satisfies Vec3
export const lodgeSpurLanterns = [lodgeSpur.ribGap(2)]
export const bastionLinkLanterns = [bastionLink.ribGap(4), bastionLink.ribGap(route.length - 5)]
const mouthWall = climbMouth.walls[2]
/** The tunnel opens into the mouth’s north wall at the elbow, the size of its vault and bare like the ends of the mouth’s own vaults there. */
const linkHole = {
  ...linkVault,
  name: 'link',
  u: endX - mouthWall.center[0],
  casing: false,
} as const satisfies WallOpening
mouthWall.holes = [linkHole]
/**
 * The iron gate barring the tunnel where it opens into the mouth’s elbow, barred like the apse’s gate, low over the floor and on up its bars, but for a hatch in the middle of its foot, round-headed like a mouse hole: wide enough for an orb rolling at it to slip through and on down the tunnel, far too low for anyone to follow.
 * Orbs rolling down the hairpin come out of its turn along the west leg’s west wall, and the paving falling toward its middle carries them across to the hatch; those that miss it roll back down into the hollow in front of it.
 * It stands on the tunnel’s level floor at its mouth, a step under the hollow. In the frame of the mouth’s north wall, facing south into the elbow.
 */
export const bastionLinkGate = {
  wall: mouthWall,
  hole: {
    ...linkHole,
    bottom: gateFoot,
  },
  hatch: gateMouseHole({
    u: linkHole.u,
    bottom: gateFoot,
  }),
  bands: [0.15, 1.05, 1.95],
} as const satisfies {
  bands: ReadonlyArray<number>
  hatch: WallOpening
  hole: WallOpening
  wall: Wall
}
export const bastionNetwork = [...bastionPassages, ...climbPassages, bastionLink, lodgeSpur]

/** All floors under a point, including the upper run where it crosses the lower passages, and the cistern’s over the Lodge and the curve. */
export function bastionFloors(x: number, z: number) {
  return [...bastionNetwork, {floorAt: cisternFloor}].flatMap(part => part.floorAt(x, z) ?? [])
}

/** Whether the position lies between any Bastion passage’s floor and vault, or in the cistern. */
export function insideBastion(position: Vec3) {
  return bastionNetwork.some(passage => passage.contains(position)) || insideCistern(position)
}
