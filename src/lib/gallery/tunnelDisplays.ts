import type {Wall} from '../placement/wallGeometry.ts'
import type {TunnelSide} from './exhibitionTunnel.ts'
import type {FloorPolygon} from './floorPolygons.ts'
import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {wallFace, wallOpeningTrim} from './architectureDimensions.ts'
import {frameToWorld, lineWall, tunnelCorners, tunnelSlopeHeight as tunnelFloorHeight, tunnelFrame, worldToFrame} from './exhibitionTunnel.ts'
import {insidePolygon, rectanglePolygon} from './floorPolygons.ts'
import lowerGallery from './lowerGallery.ts'
import oculusBalcony from './oculusBalcony.ts'
import StairFlight from './stairs/StairFlight.ts'

type Point = readonly [number, number]
type Range = readonly [number, number]

const {oculus, tunnel} = lowerGallery
const {elbow, half, length} = tunnelFrame
/** the glazed window in the tunnel’s wall in front of each display: its sill and head over the tunnel’s floor */
export const tunnelDisplayWindow = {
  bottom: 0.55,
  top: 2.85,
  glassThickness: 0.06,
}
/** how far each display reaches north past its window, behind the tunnel’s wall, to give the pedestal at its low end room */
export const displayNorthExtension = 1
/** how far the middle of the first exhibit lies south of its display’s north end, and the middle of the last north of its south end: their pedestals reach 2.7 m north and 1.55 m south of them (see exhibits.ts), and leave 0.5 m before the north end and 0.9 m, the way in from the cutout, before the south end */
export const exhibitInsets = {
  north: 3.2,
  south: 2.45,
}
/** how far the displays, their stairways and their landings keep clear of the center lines of the walls of the Oculus and Moonfall, a little more than those walls’ faces */
const roomMargin = 0.12
/** how far the displays’ end walls and windows keep clear of the tunnel’s corners and elbows */
const margin = 0.05
const depth = 3.2
const thickness = 0.18
const ceilingThickness = 0.18
/**
 * A staff stairway runs down behind each display, from a door in the Oculus’ south wall at the balcony, turning onto the diagonal right behind the display’s back wall, down two flights with a level stretch between them to a landing before a cutout in the display’s south end wall.
 * The door sits wherever the turn onto the diagonal puts it, so the stairway’s wall nearer the Oculus’ middle line runs straight on from the door’s jamb.
 */
export const displayStairway = {
  /** between the outsides of its walls, which stand inside it */
  width: 2.1,
  /** over the floors, where its ceilings hang, still below the floors of the ground floor above */
  headroom: 2.8,
  /** how deep each step is; every flight takes whole steps */
  going: 0.4,
  /** about how high each step rises; the drop from the balcony to the landing takes as many steps as come closest, which all rise alike */
  rise: 0.15,
  /** the least level floor behind the door, in front of its casing, before the first step down */
  threshold: 0.4,
  /** narrow enough for the door’s casing to fit between the stairway’s walls */
  doorWidth: 1.7,
  /** low enough for the door’s casing to stay below the cornice of the Oculus’ south wall */
  doorHeight: 2.1,
  /** the cutout in the display’s south end wall, from the display’s back wall */
  cutoutWidth: 1.5,
  /** how far the landing reaches south past the display’s south end wall */
  landingDepth: 1.5,
}
const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
/** the line of the Oculus’ south wall, which the stairways’ doors pierce, and the line of Moonfall’s north wall, which the landings stay north of */
const oculusWallZ = tunnel.north[1]
const moonfallWallZ = tunnel.south[1]
export type DisplayBox = {
  position: Vec3
  size: Vec3
}
/** a stretch of air in the museum’s meters over a convex piece of floor, from its lowest floor up to its highest ceiling */
export type DisplayAir = {
  bottom: number
  polygon: FloorPolygon
  top: number
}
/** a slab in the diagonal’s frame over a convex piece of floor, from `bottom` to `top`, like a floor, a ceiling or a header */
export type DisplaySlab = {
  bottom: number
  name: string
  polygon: FloorPolygon
  top: number
}
/** a level floor of the stairway in the diagonal’s frame, with its ceiling hanging `headroom` over it */
type DisplayLevel = {
  floor: number
  headroom: number
  polygon: FloorPolygon
}

const area = (x: Range, z: Range): FloorPolygon => rectanglePolygon({
  center: [(x[0] + x[1]) / 2, (z[0] + z[1]) / 2],
  size: [Math.abs(x[1] - x[0]), Math.abs(z[1] - z[0])],
})
/** the direction in the diagonal’s frame of the direction in the museum’s meters */
const frameDirection = ([x, z]: Point): Point => {
  const [ox, oz] = worldToFrame([0, 0])
  const [px, pz] = worldToFrame([x, z])
  return [px - ox, pz - oz]
}
/** where the lines through the points along the directions meet */
const meet = (a: Point, da: Point, b: Point, db: Point): Point => {
  const share = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / (da[0] * db[1] - da[1] * db[0])
  return [a[0] + da[0] * share, a[1] + da[1] * share]
}
/** how far the point lies down the diagonal’s frame from its start at `x` across it where it lies `worldZ` meters along the museum’s z */
const frameZAt = (x: number, worldZ: number) => {
  const [, originZ] = tunnelFrame.origin
  const [acrossZ, alongZ] = [frameToWorld([1, 0])[1] - originZ, frameToWorld([0, 1])[1] - originZ]
  return (worldZ - originZ - acrossZ * x) / alongZ
}
/** The wall in the diagonal’s frame placed in the museum’s meters. */
const placeWall = (wall: Wall): Wall => {
  const [x, z] = frameToWorld([wall.center[0], wall.center[2]])
  return {
    ...wall,
    center: [x, wall.center[1], z],
    rotation: wall.rotation + tunnelFrame.yaw,
  }
}
/** The display’s lines across the diagonal’s frame, from its window in the tunnel’s wall out to its stairway’s outer wall, and where its landing’s inner wall stands. */
function displayLines(direction: -1 | 1) {
  const frontX = direction * half
  const backX = frontX + direction * depth
  const outsideX = backX + direction * thickness
  const outerX = outsideX + direction * displayStairway.width
  const cutoutFrom = backX - direction * displayStairway.cutoutWidth
  return {
    frontX,
    backX,
    outsideX,
    outerX,
    cutoutFrom,
    landingX: cutoutFrom - direction * wallFace,
  }
}
const sideDirections = {
  west: -1,
  east: 1,
} as const satisfies Record<TunnelSide, -1 | 1>
/**
 * Per side, how far north the display may start and how far south it may end: its window, with its casing, in the sloping stretch of the tunnel’s wall, its end walls clear of the corners where the tunnel’s wall turns, its north end wall clear of the Oculus’ wall and its landing clear of Moonfall’s.
 * The window starts {@link displayNorthExtension} south of the display’s north end and ends at its south end.
 */
const reaches = Object.fromEntries(Object.entries(sideDirections).map(([side, direction]) => {
  const {frontX, outsideX, outerX, landingX} = displayLines(direction)
  const corners = tunnelCorners[side as TunnelSide]
  const north = Math.max(elbow + wallOpeningTrim + margin - displayNorthExtension, corners.north + thickness + margin, ...[frontX, outsideX].map(x => frameZAt(x, oculusWallZ + roomMargin) + thickness))
  const south = Math.min(length - elbow - wallOpeningTrim - margin, corners.south - thickness - margin, ...[landingX, outerX].map(x => frameZAt(x, moonfallWallZ - roomMargin) - thickness - displayStairway.landingDepth))
  return [side, {
    north,
    south,
  }]
})) as Record<TunnelSide, Record<'north' | 'south', number>>

/** The point in the museum’s meters of the point in the diagonal’s frame, at its height. */
export const placeInWorld = ([x, y, z]: Vec3): Vec3 => {
  const [worldX, worldZ] = frameToWorld([x, z])
  return [worldX, y, worldZ]
}

/**
 * The display behind each of the tunnel’s side walls along its diagonal, with its exhibits and its staff stairway, laid out in the diagonal’s frame, see {@link tunnelFrame}, unless said otherwise.
 * Each display takes up all of its site, so the one on the west, which starts further south behind the turn out of the Oculus, ends further south too, and the one on the east, whose stairway’s landing runs into Moonfall’s wall sooner, is shorter.
 */
const tunnelDisplays = (['west', 'east'] as const).map(side => {
  const direction = sideDirections[side]
  const {frontX, backX, outsideX, outerX, cutoutFrom, landingX} = displayLines(direction)
  const {north: northZ, south: southZ} = reaches[side]
  const centerX = (frontX + backX) / 2
  const centerZ = (northZ + southZ) / 2
  const floorY = tunnelFloorHeight(centerZ)
  const window: Range = [northZ + displayNorthExtension, southZ]
  const id = `${side}-display`
  const {headroom, going, width: stairWidth} = displayStairway
  const innerX = outsideX
  const middleX = (innerX + outerX) / 2
  // The stairway turns from the door, along the museum’s z, onto the diagonal around the corner on the side the diagonal drifts away from, where the door’s jamb lines up with the stairway’s wall.
  const entryDirection = frameDirection([0, 1])
  const pivotX = entryDirection[0] > 0 ? Math.min(innerX, outerX) : Math.max(innerX, outerX)
  const otherX = pivotX === innerX ? outerX : innerX
  /** toward the stairway’s other wall along the museum’s x, from the pivot */
  const toward = Math.sign(otherX - pivotX) * Math.sign(frameToWorld([1, 0])[0] - frameToWorld([0, 0])[0])
  const threshold = wallFace + displayStairway.threshold
  const startZ = frameZAt(pivotX, oculusWallZ + threshold)
  const pivot = frameToWorld([pivotX, startZ])
  /** the door’s middle on the Oculus’ wall, in the museum’s meters */
  const doorAt: Point = [pivot[0] + toward * stairWidth / 2, oculusWallZ]
  const doorJambs = [pivot[0], pivot[0] + toward * stairWidth].map(x => worldToFrame([x, oculusWallZ]))
  /** where the stairway’s other wall, running down from the door along the museum’s z, meets its line along the diagonal */
  const otherCorner = meet(doorJambs[1], entryDirection, [otherX, 0], [0, 1])
  const entry: DisplayLevel = {
    polygon: [doorJambs[0], doorJambs[1], otherCorner, [otherX, startZ], [pivotX, startZ]],
    floor: balconyY,
    headroom,
  }
  // The drop from the balcony to the landing takes the whole steps that come closest to the step’s rise, each flight a step more than it has treads.
  const landingY = tunnelFloorHeight(southZ)
  const steps = Math.round((balconyY - landingY) / displayStairway.rise)
  const rise = (balconyY - landingY) / steps
  const upperCount = Math.floor((steps - 2) / 2)
  const lowerCount = steps - 2 - upperCount
  const upperEndZ = startZ + upperCount * going
  const landingNorthZ = southZ + thickness
  const landingSouthZ = landingNorthZ + displayStairway.landingDepth
  const lowerStartZ = landingNorthZ - lowerCount * going
  if (lowerStartZ - upperEndZ < 1) {
    throw new RangeError(`The ${id}’s stairway needs room for a level stretch between its flights.`)
  }
  const middleY = balconyY - (upperCount + 1) * rise
  const flights = [
    new StairFlight(`${id}-upper`, [middleX, balconyY, startZ], [middleX, middleY + rise, upperEndZ], stairWidth, upperCount, 0, 0, 'exhibition', headroom),
    new StairFlight(`${id}-lower`, [middleX, middleY, lowerStartZ], [middleX, landingY + rise, landingNorthZ], stairWidth, lowerCount, 0, 0, 'exhibition', headroom),
  ] as const
  const entryCeiling: FloorPolygon = entry.polygon.map(([x, z]) => [x, z === startZ ? startZ + 0.1 : z])
  const middle: DisplayLevel = {
    polygon: area([innerX, outerX], [upperEndZ, lowerStartZ]),
    floor: middleY,
    headroom,
  }
  const cutout = {
    /** its jamb by the tunnel, in line with the landing’s wall */
    from: cutoutFrom,
    /** its jamb at the display’s back wall */
    to: backX,
    /** where the display’s ceiling, which reaches over the south end wall, meets the landing’s at the wall’s outer face */
    top: tunnelFloorHeight(landingNorthZ) + tunnel.height,
  }
  /** outside the cutout, level with the display’s floor at its south end, from its wall by the tunnel out to the stairway’s outer wall, and as high as the display, so the cutout runs up to the display’s ceiling */
  const landing: DisplayLevel = {
    polygon: area([landingX, outerX], [southZ, landingSouthZ]),
    floor: landingY,
    headroom: cutout.top + ceilingThickness / 2 - landingY,
  }
  const stairWall = (name: string, from: Point, to: Point, inward: Point, floor: number, wallHeadroom = headroom) => lineWall(`exhibition-stairs_${id.replaceAll('-', '_')}_${name}`, 'exhibition', from, to, inward, floor, floor, wallHeadroom - 0.3)
  const flightWall = (flight: StairFlight, x: number): Wall => ({
    ...flight.wall(Math.sign(x - middleX)),
    trimStyle: 'plain',
  })
  const faceName = (x: number) => (Math.sign(x - middleX) === direction ? 'outer' : 'inner')
  /** The wall running on past its end at the start of the stairway’s diagonal, along the flight down it, by `back` meters. */
  const extendBack = (wall: Wall, back: number): Wall => {
    // along the wall’s own x, which way the flight runs
    const forward = Math.sign(-Math.sin(wall.rotation))
    return {
      ...wall,
      center: [wall.center[0], wall.center[1] - (wall.slope ?? 0) * forward * back / 2, wall.center[2] - back / 2],
      width: wall.width + back,
    }
  }
  /** how far the walls meeting in the corner inside the turn from the door onto the diagonal run on past it, closing the wedge between their faces, as in a passage */
  const reach = wallFace * Math.tan(tunnelFrame.turn / 2)
  /** the walls down one side of the stairway, from where it turns onto the diagonal, or from the corner `from` before it, to the landing, and round the landing on its outer side */
  const sideWalls = (x: number, from?: Point) => {
    const inward: Point = [Math.sign(middleX - x), 0]
    const name = faceName(x)
    return [
      ...from ? [stairWall(`entry_${name}`, from, [x, startZ], inward, balconyY)] : [],
      // Inside the turn, it runs back past the corner.
      from ? flightWall(flights[0], x) : extendBack(flightWall(flights[0], x), reach),
      stairWall(`middle_${name}`, [x, upperEndZ], [x, lowerStartZ], inward, middleY),
      flightWall(flights[1], x),
      ...x === outerX ? [stairWall('landing_outer', [x, landingNorthZ], [x, landingSouthZ], inward, landingY, landing.headroom)] : [],
    ]
  }
  const entryInward = entryDirection
  const doorWall = stairWall('entry', doorJambs[0], doorJambs[1], entryInward, balconyY)
  const acrossInward = frameDirection([toward, 0])
  const walls = ([
    {
      ...doorWall,
      holes: [
        {
          u: 0,
          width: displayStairway.doorWidth,
          height: displayStairway.doorHeight,
          profile: 'rectangle',
        },
      ],
    },
    lineWall(`exhibition-stairs_${id.replaceAll('-', '_')}_entry_pivot`, 'exhibition', doorJambs[0], [pivotX, startZ], acrossInward, balconyY, balconyY, headroom - 0.3, [0, reach]),
    stairWall('entry_other', doorJambs[1], otherCorner, [-acrossInward[0], -acrossInward[1]], balconyY),
    ...sideWalls(pivotX),
    ...sideWalls(otherX, otherCorner),
    // It runs from the display’s south end wall on, its face in line with the cutout’s jamb.
    stairWall('landing_inner', [landingX, landingNorthZ], [landingX, landingSouthZ], [direction, 0], landingY, landing.headroom),
    stairWall('landing_south', [landingX, landingSouthZ], [outerX, landingSouthZ], [0, -1], landingY, landing.headroom),
  ] satisfies Array<Wall>).map(placeWall)
  const southEndZ = southZ + thickness / 2
  const southEnd = (fromX: number, toX: number): DisplayBox => ({
    position: [(fromX + toX) / 2, tunnelFloorHeight(southEndZ) + tunnel.height / 2, southEndZ],
    size: [Math.abs(toX - fromX), tunnel.height, thickness],
  })
  const width = southZ - northZ
  const shell: Array<DisplayBox> = [
    {
      position: [centerX, floorY - thickness / 2, centerZ],
      size: [depth, thickness, width],
    },
    // The ceiling reaches over the south end wall, sloping with the display, so the cutout runs up to it and it meets the landing’s level ceiling at the wall’s outer face.
    {
      position: [centerX, tunnelFloorHeight(centerZ + thickness / 2) + tunnel.height + thickness / 2, centerZ + thickness / 2],
      size: [depth, thickness, width + thickness],
    },
    // The back wall reaches past the south end wall, as the cutout’s jamb, to close the corner beside the landing.
    {
      position: [backX + direction * thickness / 2, tunnelFloorHeight(centerZ + thickness / 2) + tunnel.height / 2, centerZ + thickness / 2],
      size: [thickness, tunnel.height, width + thickness],
    },
    {
      position: [centerX, tunnelFloorHeight(northZ - thickness / 2) + tunnel.height / 2, northZ - thickness / 2],
      size: [depth, tunnel.height, thickness],
    },
    southEnd(frontX, cutout.from),
  ]
  /** the underside of the level’s ceiling, which hangs into its headroom by half its thickness, as the flights’ roofs do */
  const ceiling = (level: DisplayLevel) => level.floor + level.headroom - ceilingThickness / 2
  const slabDepth = oculusBalcony.size[1]
  const stairX: Range = [innerX, outerX]
  const lowerRoofTop = flights[1].end[1] + headroom + ceilingThickness / 2
  const slabs: Array<DisplaySlab> = [
    ...[entry, middle, landing].map(level => ({
      name: 'display-stairway-floor',
      polygon: level.polygon,
      bottom: level.floor - slabDepth,
      top: level.floor,
    })),
    // The ceilings reach on over the flights’ roofs to close the joints.
    ...([[entry, entryCeiling], [middle, area(stairX, [upperEndZ - 0.1, lowerStartZ + 0.1])]] as const).map(([level, polygon]) => ({
      name: 'display-stairway-ceiling',
      polygon,
      bottom: ceiling(level),
      top: ceiling(level) + ceilingThickness,
    })),
    {
      name: 'display-landing-ceiling',
      polygon: area([landingX, outerX], [landingNorthZ, landingSouthZ]),
      bottom: ceiling(landing),
      top: ceiling(landing) + ceilingThickness,
    },
    // It closes the step up from the lower flight’s roof to the landing’s ceiling, over the flight’s foot.
    {
      name: 'display-landing-header',
      polygon: area(stairX, [landingNorthZ - ceilingThickness, landingNorthZ]),
      bottom: lowerRoofTop - ceilingThickness,
      top: ceiling(landing) + ceilingThickness,
    },
  ]
  const lamp = (level: DisplayLevel, [x, z]: Point): Vec3 => [x, ceiling(level), z]
  const doorFrame = worldToFrame([doorAt[0], oculusWallZ + wallFace + 0.5])
  const landingCenter: Point = [(landingX + outerX) / 2, (landingNorthZ + landingSouthZ) / 2]
  /** under the ceilings: behind the door, in the middle of the level stretch between the flights and over the landing */
  const lamps: Array<Vec3> = [
    lamp(entry, doorFrame),
    lamp(middle, [middleX, (upperEndZ + lowerStartZ) / 2]),
    lamp(landing, landingCenter),
  ]
  const toWorld = (polygon: FloorPolygon): FloorPolygon => polygon.map(point => frameToWorld(point))
  const air: Array<DisplayAir> = [
    {
      polygon: toWorld(entry.polygon),
      bottom: balconyY,
      top: balconyY + headroom,
    },
    {
      polygon: toWorld(area(stairX, [startZ, upperEndZ])),
      bottom: middleY,
      top: balconyY + headroom,
    },
    {
      polygon: toWorld(middle.polygon),
      bottom: middleY,
      top: middleY + headroom,
    },
    {
      polygon: toWorld(area(stairX, [lowerStartZ, landingNorthZ])),
      bottom: landingY,
      top: middleY + headroom,
    },
    {
      polygon: toWorld(landing.polygon),
      bottom: landingY,
      top: landingY + landing.headroom,
    },
    {
      polygon: toWorld(area([frontX, backX], [northZ, southZ])),
      bottom: tunnelFloorHeight(northZ),
      top: tunnelFloorHeight(southZ) + tunnel.height,
    },
  ]
  // The exhibits keep their pedestals clear of both end walls and spread evenly between.
  const firstZ = northZ + exhibitInsets.north
  const spacing = (southZ - exhibitInsets.south - firstZ) / 2
  return {
    side,
    direction,
    frontX,
    backX,
    center: [centerX, centerZ] as const,
    size: [depth, width] as const,
    /** the window in the tunnel’s wall in front of the display, from its north end to its south end down the diagonal */
    window,
    shell,
    /** where the exhibits stand on the display’s floor, from its north end south */
    exhibits: [0, 1, 2].map(i => {
      const z = firstZ + i * spacing
      return {
        id: `tunnel-${side}-exhibit-${i}`,
        position: [centerX, tunnelFloorHeight(z), z] as Vec3,
      }
    }),
    stairway: {
      id,
      /** the middle of the door’s threshold on the Oculus’ south wall’s line, in the museum’s meters, at the balcony’s height */
      door: [doorAt[0], balconyY, doorAt[1]] as Vec3,
      cutout,
      /** down from the door and on from the level stretch between them to the landing */
      flights,
      treads: flights.flatMap(flight => flight.blocks),
      /** the level floors behind the door, between the flights and before the cutout */
      entry,
      middle,
      landing,
      /** in the museum’s meters */
      walls,
      /** the floors, their ceilings and the header over the lower flight’s foot */
      slabs,
      /** the sloping ceilings of both flights */
      roofs: flights.map(flight => flight.beam(headroom, ceilingThickness, flight.width)) satisfies Array<StairBeam>,
      lamps,
      /** in the museum’s meters, from the door down to the landing and the display */
      air,
    },
  }
})

export function displayFloorHeight(x: number, z: number) {
  return displayGround(x, z)?.floor
}

/** Whether the position in the museum’s meters lies in a display or on its stairway down from the Oculus balcony. */
export function insideTunnelDisplay([x, y, z]: Vec3) {
  const ground = displayGround(x, z)
  return ground !== undefined && y >= ground.floor - 1 && y <= ground.floor + ground.headroom
}

/** The floor under the point in the museum’s meters in a display, on the steps of its stairway or on one of its floors, with the headroom over it, or undefined elsewhere. */
function displayGround(worldX: number, worldZ: number) {
  const [x, z] = worldToFrame([worldX, worldZ])
  for (const display of tunnelDisplays) {
    const {stairway} = display
    const tread = stairway.treads.find(block => Math.abs(x - block.position[0]) <= block.size[0] / 2 + 1e-6 && Math.abs(z - block.position[2]) <= block.size[2] / 2 + 1e-6)
    if (tread) {
      return {
        floor: tread.top,
        headroom: displayStairway.headroom,
      }
    }
    const level = [stairway.entry, stairway.middle, stairway.landing].find(value => insidePolygon(value.polygon, x, z))
    if (level) {
      return {
        floor: level.floor,
        headroom: level.headroom,
      }
    }
    if (Math.abs(x - display.center[0]) <= display.size[0] / 2 + 1e-6 && Math.abs(z - display.center[1]) <= display.size[1] / 2 + 1e-6) {
      return {
        floor: tunnelFloorHeight(z),
        headroom: tunnel.height,
      }
    }
  }
}
// Every door’s casing has to fit on the Oculus’ south wall, between its side walls.
if (tunnelDisplays.some(({stairway: {door}}) => Math.abs(door[0] - oculus.center[0]) + displayStairway.doorWidth / 2 + wallOpeningTrim > oculus.size[0] / 2 - wallFace)) {
  throw new RangeError('The staff stairways’ doors need to fit on the Oculus’ south wall.')
}

export default tunnelDisplays
