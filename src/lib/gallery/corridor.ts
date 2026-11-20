import type {FloorRectangle} from './floors.ts'
import type {PendantMount} from './pendants/CeilingProbe.ts'
import type {Vec3} from './types.ts'

import {cutFloorOpening} from './floorPolygons.ts'
import lodge, {lodgeBay, lodgeWindowCutout} from './lodge.ts'
import Passage from './passages/Passage.ts'
import {passageRibs, timberRibInset, timberRibs} from './passages/timberLayout.ts'
import {passageLightDrop} from './pendants/mounts.ts'
import sienna, {siennaVestibule} from './sienna.ts'
import StairFlight from './stairs/StairFlight.ts'
import StairRunner from './stairs/StairRunner.ts'

type Point = readonly [number, number]
/** where a timber rib starts and ends along its span */
type Rib = readonly [number, number]

const half = lodge.timberWidth / 2
const lodgeWestX = lodge.center[0] - lodge.size[0] / 2
/** how far the Corridor’s walls keep off the Lodge’s, all the way round its bay: as far as its hall runs from the Lodge’s west wall */
const clearance = lodgeWestX - (lodge.approachX + half)
const [[, northZ], [, backZ]] = lodgeBay.corners
/** where the Corridor leaves the Lodge: through the middle of its bay’s back wall */
const doorwayX = lodge.center[0]
/** the center line of the run west along the bay’s back wall */
const runZ = backZ - clearance - half
/** the sum of x and z along the center line of the diagonal parallel to the bay’s north-west wall, whose points share theirs */
const diagonal = lodgeWestX + northZ - (clearance + half) * Math.SQRT2
/** where the diagonal hands over to the long hall south */
const hallNorthZ = diagonal - lodge.approachX
/** how far an open elbow of a 45° turn reaches into either of the spans it joins */
const elbow = half * Math.tan(Math.PI / 8)
/** where the vestibule’s west wall stands, which the Corridor ends at */
const vestibuleX = siennaVestibule.center[0] - siennaVestibule.size[0] / 2
/** the middle of the arch in the vestibule’s west wall */
const vestibuleZ = siennaVestibule.center[1]
/** how much of the landing’s passage is lined between the vestibule’s arch and its open elbow, a short reveal inside the arch */
const landingReveal = 0.3
/** where the landing turns from the diagonal east into the vestibule’s arch: its lined reveal and its open elbow short of the wall */
const landingTurn: Point = [vestibuleX - landingReveal - elbow, vestibuleZ]
/** where the hall ends, turning 45° onto the diagonal to the landing: as far north of the arch’s line as the landing’s turn lies east of the hall, as the diagonal gains as much east as south */
const hallSouthZ = vestibuleZ - (landingTurn[0] - lodge.approachX)
/** a point `along` meters down the diagonal from another */
const downDiagonal = ([x, z]: Point, along: number): Point => [x + along * Math.SQRT1_2, z + along * Math.SQRT1_2]
/** the flight’s bottom and top, an open elbow down the diagonal from the hall’s end and an open elbow up it from the landing’s turn */
const flightFoot = downDiagonal([lodge.approachX, hallSouthZ], elbow)
const flightHead = downDiagonal(landingTurn, -elbow)
/** Of the ribs along a span, the one whose middle lies nearest `along` meters down it. */
const ribNear = (ribs: ReadonlyArray<Rib>, along: number) => ribs.reduce((nearest, rib) => (Math.abs((rib[0] + rib[1]) / 2 - along) < Math.abs((nearest[0] + nearest[1]) / 2 - along) ? rib : nearest))
/** The long hall south from the diagonal round the Lodge’s bay to the turn toward the Sienna, which the Corridor is laid out around. */
const corridor = {
  center: [lodge.approachX, (hallNorthZ + hallSouthZ) / 2],
  size: [lodge.timberWidth, hallSouthZ - hallNorthZ],
  floorY: lodge.floorY,
  height: 3.4,
} as const

/**
 * From the doorway in the middle of the Lodge’s bay north, west along the bay’s back wall and diagonally along its north-west wall round to the long hall, which runs south past the Lodge’s window and turns 45° south-east onto the diagonal, where the stair flight up to the Sienna’s vestibule begins. Its walls keep the same distance from the Lodge’s all the way round.
 */
export const corridorPassage = new Passage('corridor', 'corridor', [[doorwayX, backZ], [doorwayX, runZ], [diagonal - runZ, runZ], [lodge.approachX, hallNorthZ], [lodge.approachX, hallSouthZ], flightFoot], lodge.floorY, lodge.timberWidth, corridor.height, [lodgeWindowCutout])
/** the passage’s span down the long hall */
const hallSpan = 3
const hallRibs = passageRibs(corridorPassage, hallSpan)
/** A lantern hanging from the hall’s rib `from` to `to` meters down it, under the middle of its crown and as far below the crown as passage lights hang. */
const ribLantern = ([from, to]: Rib): PendantMount => {
  const crown = corridor.floorY + corridor.height
  const z = hallNorthZ + (from + to) / 2
  return {
    anchor: [lodge.approachX, crown - timberRibInset, z],
    normal: [0, -1, 0],
    drop: passageLightDrop - timberRibInset,
    light: [lodge.approachX, crown - passageLightDrop, z],
  }
}
/** The hall’s lanterns, from its ribs: the first one at its north end, the one nearest its middle and the last one, at the foot of the flight. */
export const corridorHallLanterns = [hallRibs[0], ribNear(hallRibs, corridorPassage.spans[hallSpan].length / 2), hallRibs.at(-1)!].map(ribLantern)
/**
 * The landing at the Sienna’s floor between the flight’s top and the arch of the Sienna’s vestibule: from the arch west, a short lined reveal, then an open elbow turning 45° north-west onto the diagonal, where the flight begins.
 */
export const corridorLanding = new Passage('landing', 'corridor', [[vestibuleX, vestibuleZ], landingTurn, flightHead], sienna.floorY, lodge.timberWidth, corridor.height)
/** The doorway passage from the Lodge’s bay north to the run along it, `from` to `to` meters out of the bay, as a rectangle across the passage. */
const doorwayPassage = (from: number, to: number): FloorRectangle => ({
  center: [doorwayX, backZ - (from + to) / 2],
  size: [lodge.timberWidth, to - from],
})
/** The rib of the doorway passage nearest its middle, which the joint between the Lodge’s planks and the Corridor’s boards lies under. */
const jointRib = ribNear(passageRibs(corridorPassage, 0), corridorPassage.spans[0].to / 2)
/** Where the Corridor ends toward the Lodge: under the rib of the doorway passage between them nearest its middle. */
export const corridorEndZ = backZ - (jointRib[0] + jointRib[1]) / 2
/** The Lodge’s part of the doorway passage from the Corridor, laid with the Lodge’s planks to mark it. */
export const lodgeThreshold = doorwayPassage(0, backZ - corridorEndZ)
/** The Corridor’s board floor, without the Lodge’s threshold; collision still uses the full floors. */
export const corridorPaving = corridorPassage.floors.flatMap(floor => cutFloorOpening(floor, lodgeThreshold))
/** The timber saddle where the Lodge’s planks meet the Corridor’s boards: across the doorway passage, under the rib over that joint and as deep as the rib. */
export const lodgeThresholdSaddle = doorwayPassage(...jointRib)
/**
 * The flight down the diagonal from the landing’s open elbow to the hall’s, between the two 45° turns. Its top tread begins at the landing’s floor and its bottom one ends on the hall’s, without any landing of its own: the elbows are its landings.
 * Its steps rise 19 cm, more than the player snaps down to the ground, so the landing’s floor never snaps a player down onto the top tread. It is lined as high over its grade as both passages over their floors.
 */
export const corridorStairs = new StairFlight('return', [flightHead[0], sienna.floorY, flightHead[1]], [flightFoot[0], lodge.floorY, flightFoot[1]], lodge.timberWidth, 26, 0, 0, 'corridor', corridor.height)
/** The landing’s edge over the flight’s top tread, laid as a tread itself. */
export const corridorStairHead = corridorStairs.headBlock()
/** The landing’s floorboards round the flight’s head, the Sienna’s like the floor they run on from; collision still uses the landing’s full floors. */
export const corridorLandingPaving = corridorLanding.floors.flatMap(floor => corridorStairs.outsideHead(floor))
/** how far down the flight the middle of its lining’s first rib lies, flush with the flight’s top over its first tread */
const headRibAlong = timberRibs(0, corridorStairs.length)[0].reduce((sum, end) => sum + end) / 2
const headRibAnchor: Vec3 = [
  flightHead[0] + corridorStairs.heading[0] * headRibAlong,
  corridorStairs.start[1] + corridorStairs.grade * headRibAlong + corridorStairs.headroom - timberRibInset,
  flightHead[1] + corridorStairs.heading[1] * headRibAlong,
]
/** the underside of the flight’s ribs, which slopes down the flight with its grade */
const headRibSlant = Math.hypot(corridorStairs.grade, 1)
const headRibNormal: Vec3 = [corridorStairs.grade * corridorStairs.heading[0] / headRibSlant, -1 / headRibSlant, corridorStairs.grade * corridorStairs.heading[1] / headRibSlant]
/** The lantern at the top of the flight, by the landing: hung from the middle of the flight’s first rib, as far under the lining’s crown as the hall’s lanterns. */
export const corridorLandingLantern: PendantMount = {
  anchor: headRibAnchor,
  normal: headRibNormal,
  drop: passageLightDrop - timberRibInset,
  light: [headRibAnchor[0], headRibAnchor[1] - passageLightDrop + timberRibInset, headRibAnchor[2]],
}
// A 2.4 m runner leaves wide oak margins and clears both handrails’ posts.
export const corridorRunner = new StairRunner(corridorStairs, 2.4)
export const corridorRails = [-1, 1].map(side => corridorStairs.beam(1, 0.065, 0.065, side * (corridorStairs.width / 2 - 0.23)))
export const corridorWalls = [...corridorPassage.walls, ...corridorLanding.walls, ...[-1, 1].map(side => corridorStairs.wall(side))].map(wall => ({
  ...wall,
  trimStyle: 'none' as const,
}))

export function corridorStairFloor(x: number, z: number) {
  return corridorStairs.floorAt(x, z)
}

export function insideCorridor(position: Vec3) {
  return corridorPassage.contains(position) || corridorLanding.contains(position) || corridorStairs.contains(position)
}

export default corridor
