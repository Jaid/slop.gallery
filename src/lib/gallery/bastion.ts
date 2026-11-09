import type {RouteOpening, RouteOutline} from './passages/RoutedPassage.ts'
import type {Vec3} from './types.ts'

import {mulberry32} from 'math/random'

import {corniceBands, openingCasingFronts, vaultShellThickness, wallFace, wallOpeningTrim} from './architectureDimensions.ts'
import {easedRampGradient} from './easedRamp.ts'
import lodge from './lodge.ts'
import lowerGallery, {oculusPlatform} from './lowerGallery.ts'
import oculusApse from './oculusApse.ts'
import oculusTower, {towerBridge} from './oculusTower.ts'
import Passage from './passages/Passage.ts'
import PassageRoute from './passages/PassageRoute.ts'
import PassageTransition from './passages/PassageTransition.ts'
import RoutedPassage from './passages/RoutedPassage.ts'
import vaultOpening from './passages/vaultOpening.ts'

/** an opening through the apse’s round wall into the Bastion behind it, barred with iron: centered at a polar `angle` round the center of the apse’s arc it pierces; its `width` runs along the wall’s center line, and its `bottom`, `height` and the `rise` of its segmental arch stand over the platform */
export type ApseOpening = {
  angle: number
  /** which of the apse’s arcs it pierces: 0 the west shoulder, 1 the crown and 2 the east shoulder */
  arc: number
  /** where it comes out on the Bastion’s side, splayed through the gap between both walls like an embrasure: the polar angle of its middle, its width along the apse’s center line, and its height and the rise of its arch over the platform */
  back: {
    angle: number
    height: number
    rise: number
    width: number
  }
  /** the heights of the flat iron bands across its bars, over the platform */
  bands: ReadonlyArray<number>
  bottom: number
  height: number
  /** its name among the holes of its walls */
  name: string
  rise: number
  width: number
}

const {oculus} = lowerGallery
const width = lodge.passageWidth
/** how far the passage’s walls stand behind the Oculus’ */
export const bastionClearance = 0.3
/** how far the passage’s center line runs from the center lines of the Oculus’ walls */
const offset = bastionClearance + width / 2
/** where the passage leaves the Oculus: level with the end of the east bridge, which climbs to it from the deck */
const doorwayY = oculusTower.floorY + oculusTower.height + towerBridge.rise
const [lowerBand] = corniceBands
/** where the Oculus’ walls end, 30 cm under its ceiling */
const oculusWallTop = oculus.ceiling.topY - oculus.ceiling.thickness - 0.3
/** high enough for the casing round the arch of its doorway in the Oculus’ east wall to run up into the lower band of that wall’s cornice and end flush with its top, joining the cornice */
const mouthHeight = oculusWallTop - lowerBand.drop + lowerBand.height / 2 - wallOpeningTrim - doorwayY
/** The approach to the Lodge keeps the height the whole passage used to have. */
const approachHeight = 3.1
/** Round the apse, at the platform’s level, it rises high enough for the gate and the windows into the apse, casings included, to stay under where its vault springs from its walls. */
const apseHeight = 5.2
const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
const eastWallX = oculus.center[0] + oculus.size[0] / 2
/** where the passage runs north along the Oculus’ east wall */
const runX = eastWallX + offset
/** where the mouth hands over to the curve, past the elbow behind the doorway, so a stretch of vault separates the elbow from the curve’s ribs */
const curveZ = oculusTower.z - width / 2 - 0.8
/** how long the run north along the Oculus is, from the mouth to where the apse begins */
const runLength = curveZ - oculusApse.northZ
/** how steep the Bastion’s ramps get halfway, where their eased profile is steepest: like the straight ramps they replaced */
const steepest = 0.25
/** How long a ramp has to be to climb or fall by `rise` without getting steeper than `steepest`. */
const rampLength = (rise: number) => Math.abs(rise) * easedRampGradient(0.5, 1) / steepest

/** The doorway in the Oculus’ east wall at the east bridge’s end, as wide and as high as the passage, its floor level with the bridge’s end. */
export const bastionDoorway = {
  x: eastWallX,
  y: doorwayY,
  z: oculusTower.z,
  width,
  height: mouthHeight,
}
/** From the doorway east and round an elbow to the north, level with the bridge’s end. */
export const bastionMouth = new Passage('mouth', 'bastion', [[eastWallX, oculusTower.z], [runX, oculusTower.z], [runX, curveZ]], doorwayY, width, mouthHeight)

const [west, crown, east] = oculusApse.arcs
const eastRadius = east.radius + offset
/** The ramp down from the doorway to the platform’s level runs on past the run north into the turn round the apse’s east shoulder, this far round it. */
const eastRampTurn = (rampLength(platformY - doorwayY) - runLength) / eastRadius
/** the radius of the bend that takes the curve out of the apse’s west shoulder, in an S, back west toward the Lodge */
const bendRadius = 3
const westRadius = west.radius + offset
// The bend is tangent to the run toward the Lodge, its center north of the run, and to the turn round the west shoulder, outside of it.
const bendCenterZ = lodge.tunnelZ - bendRadius
const bendCenterX = west.center[0] - Math.sqrt((westRadius + bendRadius) ** 2 - (bendCenterZ - west.center[1]) ** 2)
/** where the bend leaves the turn round the west shoulder, as the polar angle round that shoulder’s center */
const bendAngle = Math.atan2(bendCenterZ - west.center[1], bendCenterX - west.center[0]) + Math.PI * 2
/** how far round the west shoulder the curve turns before the bend takes over */
const westTurn = west.to - bendAngle
/** how far the bend turns back: past west, the crown’s second half turned the curve, and the west shoulder on top of that */
const bendTurn = (crown.to - crown.from) / 2 + westTurn
/** The straight run after the landing climbs to the Lodge’s floor. */
const climbLength = rampLength(lodge.floorY - platformY)
/** how far the connecting tunnel keeps off the faces and backs of its neighbors’ walls and vaults */
const linkGap = 0.01
const lodgeSouthZ = lodge.center[1] + lodge.size[1] / 2
/** where the north wall of the western climb’s mouth stands: the Bastion’s mouth mirrored across the tower */
const climbMouthNorthZ = oculusTower.z - width / 2
/**
 * Along the strip between the Lodge and the climb’s mouth, the connecting tunnel takes up all the room there is: the back of its vault stays behind the face of the Lodge’s south wall, and the faces of its walls in front of the back of the mouth’s vault.
 * That stands as far out behind the mouth’s north wall as the tunnel’s own behind its walls, so the back of the tunnel’s vault on that side also stays behind the face of the mouth’s wall.
 */
const linkNorthZ = lodgeSouthZ - wallFace + vaultShellThickness + linkGap
const linkSouthZ = climbMouthNorthZ + wallFace - vaultShellThickness - linkGap
/** how wide the connecting tunnel is, all the way from the curve to the climb’s mouth */
export const bastionLinkWidth = linkSouthZ - linkNorthZ
/** where the tunnel’s center line runs along the strip */
export const bastionLinkStripZ = (linkNorthZ + linkSouthZ) / 2
/** where the left wall of the run toward the Lodge stands, which the tunnel opens out of */
const runLeftZ = lodge.tunnelZ + width / 2
/** A narrow branch from the connecting tunnel’s wall facing the Lodge, at the place seen from the tunnel, see `lodgeSpur`: where its center line runs, how far apart its walls stand, how high its vault rises over the Lodge’s floor, which it climbs to, and where it ends, back to back with the left wall of the run toward the Lodge. */
export const lodgeSpurX = -16.93
export const lodgeSpurWidth = 3
export const lodgeSpurHeight = 3.55
export const lodgeSpurEndZ = runLeftZ
/**
 * The barred window through the wall the branch ends against, behind the empty suit of armor standing at its end, looking out over the run’s ramp: on the branch’s center line, its sill and the crown of its segmental arch over the Lodge’s floor, which the branch’s end lies level with, and the flat iron band across its bars over the same floor.
 * Bare like the ends of the vaults, it breaks into the run’s vault, which springs lower than its head there.
 */
export const lodgeSpurWindow = {
  width: 2,
  bottom: 0.95,
  height: 2.55,
  rise: 0.3,
  bands: [2.05],
} as const
/** where that wall’s line meets the passage’s usual distance from the apse’s west shoulder: the tunnel’s east wall runs on south from there, along the Oculus */
const linkEastX = west.center[0] - Math.sqrt((west.radius + bastionClearance) ** 2 - (runLeftZ - west.center[1]) ** 2)
/** where the tunnel’s center line leaves the curve */
const linkX = linkEastX - bastionLinkWidth / 2
/** where the tunnel’s west wall stands */
const linkWestX = linkX - bastionLinkWidth / 2
/** The S bend hands over to a level landing that reaches to the tunnel’s west wall, so the doorway opens in a level wall; from there on, the run climbs. */
const landingLength = bendCenterX - linkWestX
/** a window’s width along the apse’s wall, a little narrower than the gate */
const windowWidth = 2.4
/** how far along the crown from the gate the windows’ middles lie: as far out as they fit, 30 cm of the crown’s wall left beside their casings toward the shoulders */
const windowAlong = (crown.to - crown.from) * crown.radius / 2 - 0.3 - windowWidth / 2 - wallOpeningTrim
const windowTurn = windowAlong / crown.radius
/**
 * How much wider the windows open on the Bastion’s side, toward the gate: the lantern behind the gate hangs on the curve’s center line, and its light slants through them toward the shoulders, shifting toward the gate across the gap and the curve’s wall, out to the casing round the window there, by this much at their jambs nearest the gate.
 * Splayed like an embrasure, they let it through all the way across.
 */
const windowSplay = (windowAlong - windowWidth / 2) * (bastionClearance + openingCasingFronts.plain) / offset
/** The light also climbs toward the lantern on the way back through the windows, so they open higher there, under a flatter arch, as high as the casing round them stays under where the vault springs. */
const windowBack = {
  width: windowWidth + windowSplay,
  height: apseHeight - width / 2 - wallOpeningTrim - 0.05,
  rise: 0.3,
}
/** The gate in the middle of the apse’s crown and a window to either side of it, close enough for the lantern behind the gate to throw the bars of all three onto the platform, all opening onto the curve behind them. */
export const apseOpenings: ReadonlyArray<ApseOpening> = [
  {
    name: 'west_window',
    arc: 1,
    angle: Math.PI * 3 / 2 - windowTurn,
    back: {
      ...windowBack,
      angle: Math.PI * 3 / 2 - windowTurn + windowSplay / 2 / crown.radius,
    },
    width: windowWidth,
    // low, so the light slanting down through them lands on the platform close by
    bottom: 0.7,
    height: 2.6,
    rise: 0.6,
    bands: [1.5],
  },
  {
    name: 'gate',
    arc: 1,
    angle: Math.PI * 3 / 2,
    // The lantern hangs right behind it.
    back: {
      angle: Math.PI * 3 / 2,
      width: 3,
      height: 3,
      rise: 0.9,
    },
    width: 3,
    bottom: 0,
    height: 3,
    rise: 0.9,
    // low over the floor and on up its leaves, like a gate’s rails
    bands: [0.15, 1.05, 1.95],
  },
  {
    name: 'east_window',
    arc: 1,
    angle: Math.PI * 3 / 2 + windowTurn,
    back: {
      ...windowBack,
      angle: Math.PI * 3 / 2 + windowTurn - windowSplay / 2 / crown.radius,
    },
    width: windowWidth,
    // low, so the light slanting down through them lands on the platform close by
    bottom: 0.7,
    height: 2.6,
    rise: 0.6,
    bands: [1.5],
  },
]
/** Where an opening’s middle lies on the center line of the apse’s wall, or `out` meters further out round the same center. */
export function apseOpeningPoint({arc, angle}: Pick<ApseOpening, 'angle' | 'arc'>, out = 0) {
  const {center, radius} = oculusApse.arcs[arc]
  return [center[0] + Math.cos(angle) * (radius + out), center[1] + Math.sin(angle) * (radius + out)] as const
}

/**
 * North along the Oculus’ east wall, easing down to the platform’s level as its vault rises, on into the turn round the apse’s east shoulder, then round the apse at the same distance from its walls, over its crown and into its west shoulder. A level S bend and a short landing open onto the connecting tunnel before the straight run eases up to the Lodge’s floor.
 * Its center line runs `offset` meters from the apse’s, so its turns share their centers with the apse’s arcs.
 */
const route = new PassageRoute([runX, curveZ], -Math.PI / 2, doorwayY, mouthHeight, [
  {
    y: platformY,
    height: apseHeight,
    steps: [
      {length: runLength},
      {
        radius: eastRadius,
        angle: -eastRampTurn,
      },
    ],
  },
  {
    radius: eastRadius,
    angle: -(east.to - east.from - eastRampTurn),
  },
  {
    radius: crown.radius + offset,
    angle: -(crown.to - crown.from),
  },
  {
    radius: westRadius,
    angle: -westTurn,
  },
  {
    radius: bendRadius,
    angle: bendTurn,
  },
  {length: landingLength},
  {
    y: lodge.floorY,
    height: approachHeight,
    steps: [
      {length: climbLength},
    ],
  },
])
const approachX = bendCenterX - landingLength - climbLength
if (Math.hypot(route.end.point[0] - approachX, route.end.point[1] - lodge.tunnelZ) > 1e-6) {
  throw new Error('The Bastion’s curve has to end where its approach to the Lodge begins.')
}
/** The openings as seen from the curve: in its left wall, the one toward the apse, where they come out at the back of the gap, their jambs pointing to the arcs’ centers. */
const curveOpenings = apseOpenings.map(({name, arc, back, bottom}): RouteOpening => {
  const {radius} = oculusApse.arcs[arc]
  const [x, z] = apseOpeningPoint({
    arc,
    angle: back.angle,
  }, offset)
  return {
    name,
    along: route.project(x, z)!.along,
    side: -1,
    width: back.width * (radius + bastionClearance) / radius,
    bottom,
    height: back.height,
    rise: back.rise,
    profile: 'arch',
  }
})
// The ramps level out at the platform before the casings round the windows begin, so their sills stand as high over the floor all along.
for (const {arc, angle, width: openingWidth} of apseOpenings.flatMap(opening => [opening, {
  ...opening.back,
  arc: opening.arc,
}])) {
  const {radius} = oculusApse.arcs[arc]
  const reach = openingWidth / 2 / radius + wallOpeningTrim / (radius + bastionClearance)
  for (const side of [-1, 1]) {
    const [x, z] = apseOpeningPoint({
      arc,
      angle: angle + side * reach,
    }, offset)
    if (route.at(route.project(x, z)!.along).y !== platformY) {
      throw new Error('The Bastion’s ramps have to level out before the openings into the apse.')
    }
  }
}
/** where the outer wall north of the apse stands, touching the curve’s outer wall over the middle of the crown */
const northWallZ = crown.center[1] - crown.radius - offset - width / 2
/** where the outer wall of the run west toward the Lodge starts, at the end of the S bend */
const climbCorner = [bendCenterX, lodge.tunnelZ - width / 2] as const
/**
 * Round the outside of the curve, from the run north along the Oculus to the run west toward the Lodge, its outer walls stand straight, with room for portraits: on north along the run’s, to a corner with the one north of the apse, which a 45° chamfer brings back to the run west.
 * The curve widens out to them round the apse’s shoulders, most of all in the corner behind the east one.
 */
const outline: RouteOutline = {
  side: 1,
  corners: [
    [runX + width / 2, curveZ],
    [runX + width / 2, northWallZ],
    [climbCorner[0] + climbCorner[1] - northWallZ, northWallZ],
    climbCorner,
  ],
}
/** how many straight walls follow the apse’s west shoulder from where the bend begins to where the run’s left wall begins, each chord keeping almost as far from the apse as the curved walls do */
const shoulderChords = 4
const shoulderAngle = (point: readonly [number, number]) => Math.atan2(point[1] - west.center[1], point[0] - west.center[0]) + Math.PI * 2
const shoulderPoint = (angle: number) => [west.center[0] + Math.cos(angle) * (west.radius + bastionClearance), west.center[1] + Math.sin(angle) * (west.radius + bastionClearance)] as const
const linkCorner = [linkEastX, runLeftZ] as const
const linkCornerAngle = shoulderAngle(linkCorner)
/**
 * Inside the S bend, its walls stand straight instead of curving away from the apse: on along the apse’s west shoulder down to the line of the run’s left wall and then straight west along that line, the left wall of the level landing too.
 * That straight wall is all but doorway into the connecting tunnel, bare like the ends of vaults, the tunnel’s walls running on south from both of its ends.
 */
const landingOutline: RouteOutline = {
  side: -1,
  corners: [
    ...Array.from({length: shoulderChords}, (_, chord) => shoulderPoint(bendAngle + (linkCornerAngle - bendAngle) * chord / shoulderChords)),
    linkCorner,
    [linkWestX, runLeftZ],
  ],
}
/** A broken edge round the point in plan: `corners` corners, unevenly spaced and at uneven distances about `radius` out, where flags broke off or held. */
function brokenRing([x, z]: readonly [number, number], radius: number, corners: number, seed: number) {
  const state = mulberry32.create(seed)
  const random = () => mulberry32.sample(state)
  return Array.from({length: corners}, (_, corner) => {
    const angle = (corner + (random() - 0.5) * 0.6) / corners * Math.PI * 2
    const out = radius * (0.95 + random() * 0.1)
    return [x + Math.cos(angle) * out, z + Math.sin(angle) * out] as const
  })
}
const craterRadius = 1.6
/** on the connecting tunnel’s axis, as close to its doorway as the broken edge, at most 5% further out than `craterRadius`, stays 10 cm short of the doorway’s line */
const craterCenter: Vec3 = [linkX, platformY, runLeftZ - craterRadius * 1.05 - 0.1]
/**
 * The crater broken into the landing’s paving right in front of the connecting tunnel’s doorway, where whatever rolls down the tunnel comes out onto the landing. The paving breaks along `outline`, about `radius` meters round its middle; the flags inside it tip into the crater, their broken ends hanging over the rubble under the paving, which sinks toward its middle, `depth` meters under the floor: too high a step for an orb that fell in to roll back out, low enough for a player to step out.
 * Walking round it, the S bend leaves room south of it.
 */
export const bastionCrater = {
  center: craterCenter,
  radius: craterRadius,
  depth: 0.35,
  outline: brokenRing([craterCenter[0], craterCenter[2]], craterRadius, 23, 4243),
}
/** where the run passes the end of the blind branch beside the Lodge, climbing toward the Lodge’s floor, which the branch’s end lies level with */
const spurStation = route.at(route.project(lodgeSpurX, runLeftZ)!.along)
export const bastionCurve = new RoutedPassage('curve', 'bastion', route, width, {
  // Behind its wall, the branch’s end takes the place of the back of its vault. Cut from 5 mm inside the wall, so the cut shares no plane with the wall’s back or the collar the window leaves round its hole through the vault, which would cost the cut a third of a second.
  abutments: [{
    position: [lodgeSpurX, lodge.floorY + (lodgeSpurHeight + vaultShellThickness) / 2, lodgeSpurEndZ + (vaultShellThickness + 0.01 - 0.005) / 2],
    size: [lodgeSpurWidth, lodgeSpurHeight + vaultShellThickness, vaultShellThickness + 0.01 + 0.005],
  }],
  openings: [...curveOpenings, {
    ...vaultOpening(bastionLinkWidth, mouthHeight),
    name: 'link',
    along: route.project(linkX, runLeftZ)!.along,
    side: -1,
    casing: false,
  }, {
    name: 'lodge_spur_window',
    along: spurStation.along,
    side: -1,
    width: lodgeSpurWindow.width,
    bottom: lodge.floorY + lodgeSpurWindow.bottom - spurStation.y,
    height: lodge.floorY + lodgeSpurWindow.height - spurStation.y,
    rise: lodgeSpurWindow.rise,
    profile: 'arch',
    casing: false,
  }],
  outlines: [outline, landingOutline],
  pits: [bastionCrater.outline],
})
/** From the curve west to the Lodge’s east wall, where it turns into the Lodge’s timber. */
export const bastionApproach = new Passage('approach', 'bastion', [[approachX, lodge.tunnelZ], [lodge.center[0] + lodge.size[0] / 2, lodge.tunnelZ]], lodge.floorY, width, approachHeight)
/** The approach, all that’s left of it past the landing and the climb, trades the castle stone for the Lodge’s timber, instead of switching at the doorway. */
export const bastionTransition = new PassageTransition(bastionApproach, approachX - (lodge.center[0] + lodge.size[0] / 2))
/** how far along the curve the middle of its crown lies, behind the gate */
const crownMiddle = route.project(...apseOpeningPoint({
  arc: 1,
  angle: Math.PI * 3 / 2,
}, offset))!.along
const crownStation = route.at(crownMiddle)
/** where the Bastion’s origin lies: on the floor in the middle of the curve’s crown */
export const bastionOrigin: Vec3 = [crownStation.point[0], crownStation.y, crownStation.point[1]]
/** how far from a rib’s middle a lantern hangs at least, so its canopy sits on the bare vault beside the rib */
const ribClearance = 0.3
/** Right behind the opening `along` meters down the curve, or just beside a rib that stands in the way, on the opening’s side of it. */
const behind = (along: number) => {
  const rib = bastionCurve.ribs.find(value => Math.abs(value - along) < ribClearance)
  return rib === undefined ? along : rib + (along < rib ? -ribClearance : ribClearance)
}
/** How far along the curve its lanterns hang: a little way into the run north from the mouth, between two ribs, and behind the apse’s gate, whose light throws the bars of the gate and both windows onto the platform. */
export const bastionLanterns = {
  east: bastionCurve.ribGap(2),
  north: behind(crownMiddle),
} as const
/** The Bastion’s passages from the Oculus to the Lodge, each continuing where the one before it ends. */
export const bastionPassages = [bastionMouth, bastionCurve, bastionApproach] as const

/** Where the connecting tunnel leaves the level landing south of the S bend: the middle of its doorway on the center line of the landing’s left wall, heading south, as high as the climb’s mouth it leads to. */
export const bastionLinkStart = {
  point: [linkX, runLeftZ] as const,
  heading: Math.PI / 2,
  y: platformY,
  height: mouthHeight,
}
