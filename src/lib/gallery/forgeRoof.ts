import {wallFace, wallTop} from './architectureDimensions.ts'
import forge from './forge.ts'

/** a point of the roof’s section across the room, in meters relative to the room’s middle at floor level: z runs south, y up */
export type SectionPoint = readonly [z: number, y: number]
/** one tooth of the sawtooth roof in section, every point relative to the room’s middle */
export type RoofTooth = {
  /** where the glass plane meets the floor of the valley south of it, at the springing */
  foot: SectionPoint
  /** where the slope rises from, at the springing, north of the ridge */
  heel: SectionPoint
  /** the top of the glazing’s clear opening, where the solid slope’s underside meets the glass plane: the ridge seen from inside */
  ridge: SectionPoint
  /** the bottom of the glazing’s clear opening, on the glass plane, where it meets the top of the valley piece below it */
  sill: SectionPoint
}
/** a solid piece of the roof in section: the underside facing the room, then the top facing the sky, both from north to south */
export type RoofPiece = {
  top: ReadonlyArray<SectionPoint>
  underside: ReadonlyArray<SectionPoint>
}

/**
 * The Forge’s sawtooth roof, in meters relative to the room’s middle at floor level, the way 19th century workshops were lit, but turned to face the midday sun instead of the north, so it shines in.
 *
 * An iron wall plate runs round the top of the brick walls. On it, three teeth run across the room from east to west: each a solid slope of limewashed boarding under slates, rising southward to a ridge, then a steep pane of wired glass falling back to the valley gutter in front of the next one. Each glazed face is a lattice girder spanning between the gables, the glass held by sash bars behind it.
 * The gables at the east and west ends are as thick as the plate is deep, so the shell of the Lobby’s vault, which overhangs the wall the Forge shares with the Lobby, stays inside the eastern one.
 * A flat strip of boarding closes the roof between the last glazed face and the south wall, behind a brick parapet over that wall.
 */
const forgeRoof = {
  /** the underside of the roof where it rests on the walls and the plate, and of every valley */
  springY: wallTop,
  /** the iron plate round the top of the walls: how far it stands out of the walls’ faces and how deep it is, its top level with the springing */
  plate: {
    projection: 0.45,
    depth: 0.32,
  },
  teeth: 3,
  /** horizontal run of each solid slope from its heel to its ridge */
  slope: 3.7,
  /** horizontal run of each glazed face from its ridge to its foot, so it leans back toward the sky */
  glass: 0.6,
  /** how high the ridges rise over the springing, seen from inside */
  rise: 2.2,
  /** the flat soffit of the valley gutter between a glazed face’s foot and the heel of the next slope */
  valley: 0.3,
  /** how thick the boarded, slated roof is, square to its faces */
  thickness: 0.2,
  /** the lattice girder in every glazed face: panels along it, the size of its chords and of its posts and diagonals across and into the room, and how far in front of the glass its middle lies */
  girder: {
    panels: 10,
    chord: [0.14, 0.13] as const,
    web: [0.07, 0.08] as const,
    offset: 0.1,
  },
  /** the sash bars between the panes, two to every panel of the girder, right inside the glass: their width and depth */
  sashBar: [0.035, 0.05] as const,
  /** the iron rafters under every slope, one at every post of the girders: their width and depth */
  rafter: [0.07, 0.11] as const,
  /** the wire mesh cast into the glass */
  wire: 0.0125,
  /** the brick parapet over the wall the Forge shares with the Vesper, a fire wall between the workshop and the gallery next door rising over the ridges, which hides most of the Vesper’s ceiling from the glazing: the top of its sandstone coping and the coping’s height and width; the midday sun clears it */
  parapet: {
    top: 8.45,
    coping: [0.08, 0.32] as const,
  },
} as const
const {glass, plate, rise, slope, springY, teeth, thickness, valley} = forgeRoof
const [width, depth] = forge.size
/** where the wall plate’s inner faces stand from the room’s middle, along x and along z, which the roof spans between */
export const forgeRoofSpan = [width / 2 - wallFace - plate.projection, depth / 2 - wallFace - plate.projection] as const
/** the height of every ridge seen from inside */
export const forgeRidgeY = springY + rise
/** the bottom of the wall plate */
export const forgePlateBottom = springY - plate.depth

/** The point on the springing at `z`. */
const level = (z: number): SectionPoint => [z, springY]
/** two points of a glazed face’s plane */
const glassPlane = (tooth: RoofTooth) => [tooth.ridge, tooth.foot] as const

/** The teeth of the roof from north to south. */
export function forgeRoofTeeth(): Array<RoofTooth> {
  const pitch = slope + glass + valley
  const [, halfSpan] = forgeRoofSpan
  return Array.from({length: teeth}, (_, index) => {
    const heelZ = -halfSpan + index * pitch
    const ridge: SectionPoint = [heelZ + slope, springY + rise]
    const foot: SectionPoint = [heelZ + slope + glass, springY]
    // The valley piece south of the glass is as thick as the rest; the glass starts on top of it.
    const sill = intersect(ridge, foot, [foot[0], springY + thickness], [foot[0] + 1, springY + thickness])
    return {
      heel: [heelZ, springY],
      ridge,
      foot,
      sill,
    }
  })
}
/** How far the flat strip at the south end of the roof runs from the last glazed face’s foot to the wall plate, which has to leave room for a strip at all. */
export function forgeSouthStrip() {
  return forgeRoofSpan[1] - forgeRoofTeeth().at(-1)!.foot[0]
}
/**
 * The roof’s solid pieces in section, from north to south, between which the glazed faces lie: the first from the north wall’s middle to the first ridge, one from every glazed face’s foot up to the next ridge, and the last from the last foot to the south wall’s middle. They rest on the walls and on the plate.
 * Every piece ends in a glass plane at its ridge and at its foot, so the glazing closes the roof between them exactly.
 */
export function forgeRoofPieces(): Array<RoofPiece> {
  const teethList = forgeRoofTeeth()
  const north = -depth / 2
  const south = depth / 2
  const pieces: Array<RoofPiece> = []
  for (let index = 0; index <= teethList.length; index++) {
    const before = teethList[index - 1] as RoofTooth | undefined
    const tooth = teethList[index] as RoofTooth | undefined
    const underside: Array<SectionPoint> = [before ? before.foot : level(north)]
    if (tooth) {
      underside.push(tooth.heel, tooth.ridge)
    } else {
      underside.push(level(south))
    }
    // A wall’s middle closes a piece upright, a glass plane slanting.
    const start = before ? glassPlane(before) : [level(north), [north, springY + 1]] as const
    const end = tooth ? glassPlane(tooth) : [level(south), [south, springY + 1]] as const
    pieces.push({
      underside,
      top: topOf(underside, start, end),
    })
  }
  return pieces
}

/**
 * The gables’ section: the outline of everything the roof spans across the room, from the walls’ tops to the pieces’ tops and the glass planes between them, as a closed polygon from the north wall’s middle along the springing to the south wall’s middle and back over the roof.
 */
export function forgeGableOutline(): Array<SectionPoint> {
  const pieces = forgeRoofPieces()
  const bottom: Array<SectionPoint> = [[-depth / 2, springY], [depth / 2, springY]]
  const top = pieces.flatMap(piece => piece.top)
  return [...bottom, ...top.toReversed()]
}

/** The point where the lines through `a` and `b` and through `c` and `d` cross. */
function intersect([az, ay]: SectionPoint, [bz, by]: SectionPoint, [cz, cy]: SectionPoint, [dz, dy]: SectionPoint): SectionPoint {
  const r = [bz - az, by - ay]
  const s = [dz - cz, dy - cy]
  const denominator = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(denominator) < 1e-12) {
    throw new RangeError('Parallel lines never cross.')
  }
  const t = ((cz - az) * s[1] - (cy - ay) * s[0]) / denominator
  return [az + t * r[0], ay + t * r[1]]
}
/** The line through `a` and `b` moved by `distance` to its left, seen going from `a` to `b` with z to the right and y up: the sky’s side of a line running south along the roof’s underside. */
function offsetLine([az, ay]: SectionPoint, [bz, by]: SectionPoint, distance: number): [SectionPoint, SectionPoint] {
  const length = Math.hypot(bz - az, by - ay)
  const [nz, ny] = [-(by - ay) / length * distance, (bz - az) / length * distance]
  return [[az + nz, ay + ny], [bz + nz, by + ny]]
}
/** The top of a piece whose underside runs through `points`, `thickness` above it square to every stretch, its ends where the offset lines cross `start` and `end`, each a line given by two points. */
function topOf(points: ReadonlyArray<SectionPoint>, start: readonly [SectionPoint, SectionPoint], end: readonly [SectionPoint, SectionPoint]) {
  const lines = points.slice(1).map((point, i) => offsetLine(points[i], point, thickness))
  const top: Array<SectionPoint> = [intersect(...lines[0], ...start)]
  for (let i = 1; i < lines.length; i++) {
    top.push(intersect(...lines[i - 1], ...lines[i]))
  }
  top.push(intersect(...lines.at(-1)!, ...end))
  return top
}

/** the highest point of the roof, the top of the ridges outside */
export const forgeRoofTopY = Math.max(...forgeRoofPieces().flatMap(piece => piece.top.map(([, y]) => y)))

/** The underside of the roof at `z` along the room, relative to its middle, between the wall plates: on a slope or a valley, or below the glass plane where a glazed face spans overhead. */
export function forgeRoofUnderside(z: number) {
  for (const tooth of forgeRoofTeeth()) {
    if (z >= tooth.heel[0] && z <= tooth.ridge[0]) {
      return springY + (z - tooth.heel[0]) / slope * rise
    }
    if (z > tooth.ridge[0] && z <= tooth.foot[0]) {
      return springY + (tooth.foot[0] - z) / glass * rise
    }
  }
  return springY
}

export default forgeRoof
