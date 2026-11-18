import type {RouteCrossfall, RouteOutline} from './passages/RoutedPassage.ts'

import {wallFace} from './architectureDimensions.ts'
import {bastionClearance, bastionDoorway} from './bastion.ts'
import {easedRampGradient} from './easedRamp.ts'
import forge, {forgeVestibule} from './forge.ts'
import lowerGallery from './lowerGallery.ts'
import Passage from './passages/Passage.ts'
import PassageRoute from './passages/PassageRoute.ts'
import RoutedPassage from './passages/RoutedPassage.ts'

const {oculus} = lowerGallery
/** the western climb is as wide as the Bastion’s route from the east bridge */
const {width} = bastionDoorway
/** how far the passage’s center line runs from the center line of the Forge’s west wall, which its east leg climbs along */
const offset = bastionClearance + width / 2
/** where the passage leaves the Oculus: level with the end of the west bridge, which climbs to it from the deck, like the Bastion’s doorway at the east one */
const doorwayY = bastionDoorway.y
const doorwayZ = bastionDoorway.z
const mouthHeight = bastionDoorway.height
/** From the top of its climb on, the passage is as tall as the Bastion’s approach into the Lodge. */
const levelHeight = 3.1
const westWallX = oculus.center[0] - oculus.size[0] / 2
const forgeWestX = forge.center[0] - forge.size[0] / 2
/** where the approach ends at the west arch of the Forge’s round vestibule: on the plane touching the vestibule’s wall at the arch’s middle */
const vestibuleWestX = forgeVestibule.center[0] - forgeVestibule.radius
/** the Forge’s floor, on the upper floor */
const forgeFloorY = 0
/** where the hairpin tops out: the run north from it eases up by half a meter more to the Forge’s floor, a fall gentle enough to walk without noticing, which keeps orbs rolling on down it */
const hairpinTopY = forgeFloorY - 0.5
/** how steep the hairpin gets halfway, where its eased profile is steepest: like the Bastion’s ramps */
const steepest = 0.25
/** How long a ramp has to be to climb by `rise` without getting steeper than `steepest`. */
const rampLength = (rise: number) => Math.abs(rise) * easedRampGradient(0.5, 1) / steepest
/**
 * How steeply the paving of the hairpin and of the mouth’s elbow at its foot falls from both walls toward their middles: 1 in 11, like an old gutter of a street draining down its middle, see {@link RouteCrossfall}.
 * Orbs the Forge’s alchemy machine shoots off come out of the hairpin’s turn along the outer wall of its west leg at a good 4 m/s, and the fall carries them across toward the middle just in time to reach the gate right at the hatch in its middle.
 */
export const climbCrossfall = 1 / 11
/** the radius of the hairpin’s turn, round whose inner wall a meter of floor is left */
const turnRadius = 3
/** How far past an elbow a straight stretch of vault runs before a hairpin’s ribs begin, like the Bastion’s mouth before its curve: an elbow’s reach and 0.8 m more. */
const elbowRun = (passageWidth: number) => passageWidth / 2 + 0.8
/** where the hairpin’s east leg climbs north, behind the Forge’s west wall */
const eastLegX = forgeWestX - offset
/** where its west leg climbs south, a turn’s diameter further west */
const westLegX = eastLegX - turnRadius * 2
/** where the mouth turns south into the hairpin, as far north of the doorway’s line as an elbow and a stretch of vault reach */
const turnZ = doorwayZ + elbowRun(width)
/** Both legs climb as much, so the whole hairpin eases up from the bridge’s height to its top without getting steeper than 1 in 4. */
const legLength = (rampLength(hairpinTopY - doorwayY) - Math.PI * turnRadius) / 2
/** where the approach runs east, straight at the vestibule’s middle */
const stripZ = forgeVestibule.center[1]
/** the radius of the approach’s turn from the run north into the strip east */
const approachTurn = 3
/** where the run north ends and the approach turns east toward the strip */
const approachZ = stripZ + approachTurn
/** where the approach’s north wall stands, outside its turn, facing down the run: on the line the vestibule’s wall touches with its north, which the cistern’s flat wall stands on too, back to back with it */
const northWallZ = forgeVestibule.center[1] - forgeVestibule.radius

/** The doorway in the Oculus’ west wall at the west bridge’s end: the Bastion’s doorway mirrored across the tower. */
export const climbDoorway = {
  ...bastionDoorway,
  x: westWallX,
}
/** From the doorway west under the Forge and on past its west wall, round an elbow to the south, level with the bridge’s end. */
export const climbMouth = new Passage('climb_mouth', 'bastion', [[westWallX, doorwayZ], [westLegX, doorwayZ], [westLegX, turnZ]], doorwayY, width, mouthHeight)
/**
 * South along the west leg, round a hairpin turn toward the east and back north along the east leg behind the Forge’s west wall, easing up all the way from the bridge’s height to its top as its vault rises.
 */
const route = new PassageRoute([westLegX, turnZ], Math.PI / 2, doorwayY, mouthHeight, [
  {
    y: hairpinTopY,
    height: levelHeight,
    steps: [
      {length: legLength},
      {
        radius: turnRadius,
        angle: -Math.PI,
      },
      {length: legLength},
    ],
  },
])
/**
 * Orbs the Forge’s alchemy machine shoots off roll down the hairpin on their own: down its east leg and round the outer wall of its turn, which sends every one of them out along the west leg’s west wall, however it came down; from there, the paving’s fall carries it across toward the middle, on through the mouth’s elbow to the gate in its north wall, see `bastionLinkGate`.
 * Its paving falls toward its middle all the way but for its top, where it eases out to meet the run’s level floor.
 */
export const climbHairpin = new RoutedPassage('climb_hairpin', 'bastion', route, width, {
  crossfall: {
    slope: climbCrossfall,
    easeOut: 2,
  } satisfies RouteCrossfall,
})
if (Math.hypot(route.end.point[0] - eastLegX, route.end.point[1] - turnZ) > 1e-6 || Math.abs(route.end.heading + Math.PI / 2) > 1e-9) {
  throw new Error('The Bastion’s hairpin has to end where its run north begins, heading north.')
}
/** how far short of the approach’s turn the run levels out at the Forge’s floor, so the walls along it there stand level and run on into the approach’s */
const levelRun = 1
/** From the hairpin’s top on north, over the mouth and then over the Lodge’s roof, easing up to the Forge’s floor a meter short of where the approach turns east. */
export const climbRun = new RoutedPassage('climb_run', 'bastion', new PassageRoute([eastLegX, turnZ], -Math.PI / 2, hairpinTopY, levelHeight, [
  {
    y: forgeFloorY,
    steps: [{length: turnZ - approachZ - levelRun}],
  },
  {length: levelRun},
]), width, {cornice: false})
/**
 * The low culvert through the approach’s north wall on the run’s axis, where the cistern’s channel runs out behind it, its water spilling onto the floor: a little wider than the channel’s stone, its sill a hand over the floor, see `cisternChannel`.
 * Its middle stands on the wall’s center line, in the world’s frame; its bottom and its top stand over the floor.
 */
export const climbCulvert = {
  x: eastLegX,
  z: northWallZ,
  width: 0.7,
  bottom: 0.06,
  height: 0.6,
} as const
/** The drain in the approach’s floor in front of the culvert, where the water spilling out of it lands: a grate over a sump, a hand off the wall’s face, as wide as the culvert. Its middle and size are in plan, in the world’s frame. */
export const climbDrain = {
  center: [eastLegX, northWallZ + wallFace + 0.07 + 0.21] as const,
  size: [0.5, 0.42] as const,
}
/** how long the approach’s straight stretch is, from its turn to the vestibule’s arch */
const approachStraight = vestibuleWestX - eastLegX - approachTurn
const approachRoute = new PassageRoute([eastLegX, approachZ], -Math.PI / 2, forgeFloorY, levelHeight, [
  {
    radius: approachTurn,
    angle: Math.PI / 2,
  },
  {length: approachStraight},
])
/** the center of the approach’s turn */
const [turnX, turnCenterZ] = [eastLegX + approachTurn, approachZ]
/**
 * Outside its turn, the approach’s walls stand straight: the run’s west wall goes on north to the north wall, which closes the run across its whole width, facing down it, and a chamfer leads back from that to the strip’s north wall.
 * The turn widens out to them, most of all into the corner behind it.
 */
const approachOutline: RouteOutline = {
  side: -1,
  corners: [
    [eastLegX - width / 2, approachZ],
    [eastLegX - width / 2, northWallZ],
    [eastLegX + width / 2, northWallZ],
    [turnX, stripZ - width / 2],
  ],
}
/** The approach, from the run’s end round a smooth turn east and straight on to the west arch of the Forge’s vestibule, as wide as the run, with the culvert in its north wall, where the run would have run on. */
export const climbApproach = new RoutedPassage('climb_approach', 'bastion', approachRoute, width, {
  cornice: false,
  outlines: [approachOutline],
  drains: [[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [climbDrain.center[0] + x * climbDrain.size[0] / 2, climbDrain.center[1] + z * climbDrain.size[1] / 2] as const)],
  openings: [{
    name: 'cistern',
    side: -1,
    // Straight across from where the culvert’s middle lies, out from the turn’s center
    along: approachTurn * Math.atan2(turnCenterZ - climbCulvert.z, turnX - climbCulvert.x),
    width: climbCulvert.width,
    bottom: climbCulvert.bottom,
    height: climbCulvert.height,
    profile: 'rectangle',
    casing: false,
  }],
})
/** The approach’s section as an arch: as wide as the approach and as high as its vault’s crown, the west arch of the Forge’s vestibule opens as one. */
export const climbArch = {
  width,
  height: levelHeight,
  profile: 'arch',
} as const
/** The Bastion’s western passages from the Oculus to the Forge, each continuing where the one before it ends. */
export const climbPassages = [climbMouth, climbHairpin, climbRun, climbApproach] as const

/** how far along the hairpin the apex of its turn lies, halfway round it */
const apex = legLength + Math.PI * turnRadius / 2
/** the apex of the hairpin’s turn, halfway up its climb, where the map cuts the Bastion in two: from there on to the Forge, it shows the climb on the upper floor */
export const climbApex = route.at(apex)
/**
 * The mouth keeps only the fourth lantern along its run west, just before the elbow.
 */
export const climbPassageLanterns = {
  mouth: [false, false, false, true, false],
} as const satisfies Record<string, ReadonlyArray<boolean>>
/** How far along the hairpin its lanterns hang, each between two ribs: halfway up the west leg, round the apex of the turn and halfway up the east leg. */
export const climbLanterns = {
  west: climbHairpin.ribGap(legLength / 2),
  turn: climbHairpin.ribGap(apex),
  east: climbHairpin.ribGap(route.length - legLength / 2),
} as const
/** How far along the run its lantern hangs, between two ribs halfway along it, over the Lodge’s roof. */
export const climbRunLantern = climbRun.ribGap(climbRun.route.length / 2)
/** How far along the approach its lantern hangs, between its last two ribs, on its straight stretch right before the vestibule’s arch. */
export const climbApproachLantern = climbApproach.ribGap(climbApproach.route.length - 0.5)
