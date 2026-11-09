import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {Wall, WallOpening} from '../../placement/wallGeometry.ts'
import type {Vec3} from '../types.ts'
import type {PassageCutout} from './Passage.ts'
import type {RoutePiece, RouteStation} from './PassageRoute.ts'

import {wallCoordinates} from '../../placement/wallGeometry.ts'
import {vaultShellThickness, wallFace} from '../architectureDimensions.ts'
import PassageRoute from './PassageRoute.ts'

/** the box around a stretch of a passage’s air, from its lowest floor to its highest ceiling */
export type RouteChunk = {
  max: Vec3
  min: Vec3
}
/** an opening through the wall on one `side` of a routed passage, −1 its left and 1 its right, centered `along` meters down the route; its `width` runs along the wall, and its `bottom` and `height` stand over the floor there */
export type RouteOpening = Omit<WallOpening, 'name' | 'u'> & {
  along: number
  /** its name among the holes of its wall */
  name: string
  side: -1 | 1
}
/**
 * Straight walls through `corners` that stand in for the walls on one `side` of a routed passage, −1 its left and 1 its right, along a stretch of it, which widens out to them.
 * The first and the last corner lie where that side’s own walls would stand, at joints between the route’s pieces or at its ends, and bound the stretch. In between, the walls keep at least as far from the centerline, and straight across from each place along the stretch lies one point of them, each further along them than the one before.
 */
export type RouteOutline = {
  corners: ReadonlyArray<Point>
  side: -1 | 1
}
/**
 * How a routed passage’s paving falls from the faces of both walls toward its centerline, like an old street draining down its middle: as steeply as `slope`, rise over run, all the way to the middle, which it reaches as far under the route’s floor as that takes from the nearer wall.
 * Over the first `easeIn` and the last `easeOut` meters of the route, it eases in from and back out to a level floor across, where the passage meets another one.
 */
export type RouteCrossfall = {
  easeIn?: number
  easeOut?: number
  slope: number
}
export type RoutedPassageOptions = {
  /** boxes round the ends of other passages that end against its walls, back to back with them: the back of its vault, which stands out behind its walls where it springs from them, is cut away inside them, so it doesn’t break through their end walls */
  abutments?: ReadonlyArray<PassageCutout>
  /** whether its walls carry a cornice along their tops, true by default */
  cornice?: boolean
  /** its paving falling toward its centerline, level across if left out */
  crossfall?: RouteCrossfall
  /** holes cut through its paving where a drain’s grate lies over a sump, each an outline in plan that lies on its floor: only through what shows, as its collider runs on under the grate, for whatever rolls over it */
  drains?: ReadonlyArray<ReadonlyArray<Point>>
  /** repair internal paving edges for rolling objects; disable on straight paving where Rapier’s edge repair destabilizes resting convex hulls */
  fixPavingEdges?: boolean
  openings?: ReadonlyArray<RouteOpening>
  /** at most one for each side */
  outlines?: ReadonlyArray<RouteOutline>
  /** holes broken through its paving, each an outline in plan that lies on its floor */
  pits?: ReadonlyArray<ReadonlyArray<Point>>
}
/** an outline with the stretch along the route it stands in for its side’s walls on, and where straight across from the route its walls turn their inner corners */
type PlacedOutline = RouteOutline & {
  creases: ReadonlyArray<number>
  from: number
  to: number
}
type Point = readonly [x: number, z: number]
/** where the line straight across from a station of the route toward a side meets that side’s walls: how far from the centerline and at which point, and for an outline, at which of its walls, counted from its first corner */
type SideHit = {
  distance: number
  point: Point
  segment?: number
  /** how far along an outline’s walls from its first corner */
  traveled?: number
}
type PlacedWall = {
  piece: number
  /** which of an outline’s walls it is */
  segment?: number
  side: number
  wall: Omit<Wall, 'id'>
}

/** The vault’s ribs are spaced at most this far apart before omitting those that intersect side vaults. */
export const routeRibSpacing = 3.2
export const routeRibDepth = 0.22
export const routeRibThickness = 0.085
/** Turns are cut into steps of at most this many radians, like the curved walls beside them, for the vault and the paving as for the baseboards along an outline’s walls. */
export const routeTurnStep = 1 / 32
/** how far the first and the last rib stand in from the route’s ends */
const ribInset = 0.15
/** the steps in which a chunk of air grows around a turn, in meters along the centerline */
const chunkStep = 0.05
/** how finely an outline is checked against the route, in meters along it */
const outlineCheckStep = 0.02
/** where a crossfall eases in or out, how far apart the stations stand, in meters along the route */
const crossfallStep = 0.25
const tolerance = 1e-6
/** the direction to the right of a heading, seen from above with north up */
const rightOf = (heading: number): Point => [-Math.sin(heading), Math.cos(heading)]
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)
/** a smooth step from 0 at `s` = 0 and below up to 1 at 1 and beyond */
const smoothstep = (s: number) => {
  const t = clamp(s, 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * An open-ended passage along a {@link PassageRoute} that winds through turns, may climb or fall and grow taller or lower along its ramps, and may have openings in its walls: the same footprint drives its walls, floor and air.
 * Its runs take straight walls and its turns curved ones, unless a {@link RouteOutline} stands in for those on a side along a stretch. Along a ramp, they stand level, from their lowest floor up to their highest ceiling, with their baseboards following the floor through the ramp’s knots.
 */
export default class RoutedPassage {
  /** the boxes round the ends of other passages that end against its walls, which the back of its vault is cut away inside */
  readonly abutments: ReadonlyArray<PassageCutout>
  /** where straight across from the route the walls of the outlines turn their inner corners, in meters along it */
  readonly creases: ReadonlyArray<number>
  /** how its paving falls toward its centerline, if it does */
  readonly crossfall?: RouteCrossfall
  /** the holes cut through what shows of its paving for drains, each an outline in plan */
  readonly drains: ReadonlyArray<ReadonlyArray<Point>>
  readonly fixPavingEdges: boolean
  /** the room’s id followed by the passage’s own, which its walls’ ids start with */
  readonly name: string
  /** the outlines, each with the stretch along the route it stands in for its side’s walls on */
  readonly outlines: ReadonlyArray<PlacedOutline>
  /** the holes broken through its paving, each an outline in plan */
  readonly pits: ReadonlyArray<ReadonlyArray<Point>>
  /** where the vault’s ribs stand, in meters along the route */
  readonly ribs: ReadonlyArray<number>
  /** a wall on each side of each of the route’s pieces in turn, the left one first, where the walls of an outline take the place of those of its side along its stretch, in its first piece’s place */
  readonly walls: ReadonlyArray<Wall>

  constructor(readonly id: string, readonly room: RoomId, readonly route: PassageRoute, readonly width = 2.6, {abutments = [], cornice = true, crossfall, drains = [], openings = [], outlines = [], pits = [], fixPavingEdges = true}: RoutedPassageOptions = {}) {
    if (abutments.some(box => ![...box.position, ...box.size].every(Number.isFinite) || box.size.some(size => size <= 0))) {
      throw new RangeError('A routed passage’s abutments need finite centers and positive dimensions.')
    }
    this.abutments = abutments
    this.fixPavingEdges = fixPavingEdges
    if (!(width > 0) || route.pieces.some(piece => Math.min(piece.startHeight, piece.endHeight) <= width / 2 || piece.kind === 'arc' && piece.radius <= width / 2)) {
      throw new RangeError('A routed passage needs a positive width, room for its vault all along and turns wider than half of it.')
    }
    if (crossfall && !(crossfall.slope > 0 && crossfall.slope < 0.2 && (crossfall.easeIn ?? 0) >= 0 && (crossfall.easeOut ?? 0) >= 0 && (crossfall.easeIn ?? 0) + (crossfall.easeOut ?? 0) <= route.length)) {
      throw new RangeError('A routed passage’s crossfall needs a gentle slope and to ease in and out within its route.')
    }
    if (crossfall) {
      this.crossfall = crossfall
    }
    // Not an accessor: the build bakes the walls’ openings, and its evaluator leaves accessors out.
    this.name = `${room}-${id}`
    const count = Math.max(1, Math.ceil(route.length / routeRibSpacing))
    // A side vault replaces the barrel here. Leave its intersection bare instead of slicing ribs into hanging fragments.
    this.ribs = Array.from({length: count + 1}, (_, rib) => ribInset + (route.length - ribInset * 2) * rib / count).filter(along => openings.every(opening => {
      const station = route.at(opening.along)
      return opening.height < station.height - width / 2 - routeRibThickness || Math.abs(along - opening.along) > opening.width / 2 + vaultShellThickness + routeRibDepth / 2
    }))
    const sides = new Set(outlines.map(({side}) => side))
    if (sides.size !== outlines.length) {
      throw new RangeError(`${this.name} takes at most one outline on each side.`)
    }
    // Their creases come once all stretches are known, since finding them asks where each side’s walls stand.
    this.outlines = outlines.map(outline => ({
      ...this.stretch(outline),
      creases: [],
    }))
    this.outlines = this.outlines.map(outline => ({
      ...outline,
      creases: outline.corners.slice(1, -1).map(corner => this.acrossFrom(outline, corner)),
    }))
    this.creases = this.outlines.flatMap(({creases}) => creases).toSorted((a, b) => a - b)
    for (const outline of this.outlines) {
      this.checkOutline(outline)
    }
    const placed: Array<PlacedWall> = route.pieces.flatMap((piece, index) => [-1, 1].flatMap((side): Array<PlacedWall> => {
      const outline = this.outlineAt(piece.from + piece.length / 2, side)
      if (!outline) {
        return [{
          piece: index,
          side,
          wall: this.wall(piece, side),
        }]
      }
      // The outline’s walls come once, where its stretch starts.
      return Math.abs(piece.from - outline.from) < tolerance ? this.outlineWalls(outline).map((wall, segment) => ({
        piece: index,
        segment,
        side,
        wall,
      })) : []
    }))
    const walls: Array<Wall> = placed.map(({wall}, index) => ({
      ...wall,
      id: `${this.name}_wall_${index}`,
      ...cornice ? {} : {cornice: false},
    }))
    for (const {along, side, name, bottom = 0, height, ...opening} of openings) {
      const piece = route.pieces.findIndex(value => along >= value.from && along <= value.from + value.length)
      if (piece === -1) {
        throw new RangeError(`The opening ${name} lies beyond the ends of ${this.name}.`)
      }
      const station = route.at(along)
      const hit = this.hit(station, side)
      const wall = walls[placed.findIndex(value => value.side === side && (hit.segment === undefined ? value.piece === piece : value.segment === hit.segment))]
      const foot = station.y - wall.center[1]
      wall.holes = [...wall.holes ?? [], {
        ...opening,
        name,
        u: wallCoordinates(wall, [hit.point[0], station.y, hit.point[1]]),
        // A doorway down to the wall’s foot leaves its bottom out, so it cuts on below it instead of along it.
        ...foot + bottom > 0 ? {bottom: foot + bottom} : {},
        height: foot + height,
      }]
    }
    this.walls = walls
    if ([...pits, ...drains].some(pit => pit.length < 3 || pit.some(([x, z]) => this.stationAt(x, z) === undefined))) {
      throw new RangeError(`The pits and drains of ${this.name} need at least three corners, all on its floor.`)
    }
    this.pits = pits
    this.drains = drains
  }

  /** Boxes around the passage’s air, from its floor to its ceiling, each piece cut into as many as it takes for none to reach more than `slack` meters past the passage’s walls. */
  chunks(slack: number): Array<RouteChunk> {
    return this.route.pieces.flatMap(piece => {
      const result: Array<RouteChunk> = []
      let from = 0
      while (from < piece.length - 1e-9) {
        let to = Math.min(piece.length, from + chunkStep)
        while (to < piece.length && this.fits(piece, from, Math.min(piece.length, to + chunkStep), slack)) {
          to = Math.min(piece.length, to + chunkStep)
        }
        result.push(this.chunk(piece, from, to))
        from = to
      }
      return result
    })
  }

  /** Whether the position lies on the passage’s floor, from a meter under it to its ceiling. */
  contains([x, y, z]: Vec3) {
    const station = this.stationAt(x, z)
    return station !== undefined && y >= station.y - 1 && y <= station.y + station.height
  }

  /** The height of the floor under the point, or undefined beside the passage. */
  floorAt(x: number, z: number) {
    const abreast = this.abreast(x, z)
    return abreast && abreast.station.y - this.sag(abreast.station, abreast.right)
  }

  /** How far straight across from the station toward `side`, −1 its left and 1 its right, that side’s walls stand, along their center line: half the passage’s width, or further out along an outline. */
  reach(station: RouteStation, side: number) {
    return this.hit(station, side).distance
  }

  /** The middle between the two ribs around the point `along` meters down the route, where a lantern can hang from the bare vault. */
  ribGap(along: number) {
    const next = this.ribs.findIndex(rib => rib > along)
    if (next < 1) {
      throw new RangeError('A gap between ribs lies between the first and the last one.')
    }
    return (this.ribs[next - 1] + this.ribs[next]) / 2
  }

  /** How far under the route’s floor at the station its paving lies `right` meters right of the centerline, where its crossfall makes it fall toward the middle: nowhere along the walls’ faces and behind them, deepest along the centerline. */
  sag(station: RouteStation, right: number) {
    if (!this.crossfall) {
      return 0
    }
    const {easeIn = 0, easeOut = 0, slope} = this.crossfall
    const eased = Math.min(easeIn > 0 ? smoothstep(station.along / easeIn) : 1, easeOut > 0 ? smoothstep((this.route.length - station.along) / easeOut) : 1)
    const half = Math.min(this.reach(station, -1), this.reach(station, 1)) - wallFace
    return slope * eased * Math.max(0, half - Math.abs(right))
  }

  /** The station of the route abreast of the point, or undefined beside the passage. */
  stationAt(x: number, z: number) {
    return this.abreast(x, z)?.station
  }

  /** Stations between two distances along the route, as it gives them with its turns cut into steps of `routeTurnStep`, straight across from where the outline’s walls turn their corners, and every `crossfallStep` where its crossfall eases in or out. */
  stations(from: number, to: number) {
    const stations = this.route.stations(from, to, routeTurnStep)
    const {easeIn = 0, easeOut = 0} = this.crossfall ?? {}
    const easing = [
      ...Array.from({length: Math.ceil(easeIn / crossfallStep)}, (_, index) => easeIn * index / Math.ceil(easeIn / crossfallStep)),
      ...Array.from({length: Math.ceil(easeOut / crossfallStep)}, (_, index) => this.route.length - easeOut * index / Math.ceil(easeOut / crossfallStep)),
    ]
    const extra = [...this.creases, ...easing].filter((along, index, all) => along > from && along < to && stations.every(station => Math.abs(station.along - along) > 1e-9) && all.findIndex(other => Math.abs(other - along) < 1e-9) === index).map(along => this.route.at(along))
    return [...stations, ...extra].toSorted((a, b) => a.along - b.along)
  }

  /** The station of the route abreast of the point and how far right of the centerline the point lies there, or undefined beside the passage. */
  private abreast(x: number, z: number) {
    for (const {along, right} of this.route.projections(x, z).toSorted((a, b) => Math.abs(a.right) - Math.abs(b.right))) {
      const station = this.route.at(along)
      if (right <= this.reach(station, 1) + tolerance && -right <= this.reach(station, -1) + tolerance) {
        return {
          station,
          right,
        }
      }
    }
  }

  /** Where a point lies abreast of a piece, even beyond its ends: how far into it, measured around a turn from the side of `near`, and how far to the right of its centerline. */
  private across(piece: RoutePiece, x: number, z: number, near: number) {
    if (piece.kind === 'line') {
      const [dx, dz] = [Math.cos(piece.heading), Math.sin(piece.heading)]
      const [rx, rz] = rightOf(piece.heading)
      return {
        offset: (x - piece.start[0]) * dx + (z - piece.start[1]) * dz,
        right: (x - piece.start[0]) * rx + (z - piece.start[1]) * rz,
      }
    }
    const reference = piece.startAngle + piece.sweep * near / piece.length
    const turned = Math.atan2(z - piece.center[1], x - piece.center[0]) - reference
    const wrapped = turned - Math.round(turned / (Math.PI * 2)) * Math.PI * 2
    return {
      offset: near + Math.sign(piece.sweep) * wrapped * piece.radius,
      right: Math.sign(piece.sweep) * (piece.radius - Math.hypot(x - piece.center[0], z - piece.center[1])),
    }
  }

  /** How far along the route the outline’s corner lies straight across from it, on the outline’s side. */
  private acrossFrom({side, from, to}: PlacedOutline, [x, z]: Point) {
    const projection = this.route.projections(x, z).find(({along, right}) => along >= from && along <= to && Math.sign(right) === side && Math.abs(this.reach(this.route.at(along), side) - Math.abs(right)) < tolerance)
    if (!projection) {
      throw new RangeError(`No place along ${this.name} lies straight across from the corner of its outline at ${x}, ${z}.`)
    }
    return projection.along
  }

  /** Throws unless the outline keeps at least as far from the centerline as its side’s own walls, behind the center of every turn toward its side, and runs on along with the route. */
  private checkOutline({side, from, to}: PlacedOutline) {
    let traveled = 0
    for (let along = from; along <= to + 1e-9; along += outlineCheckStep) {
      const station = this.route.at(Math.min(along, to))
      const hit = this.hit(station, side)
      const piece = this.route.pieces.find(value => station.along <= value.from + value.length + tolerance)!
      if (hit.distance < this.width / 2 - tolerance || piece.kind === 'arc' && Math.sign(piece.sweep) === side && hit.distance > piece.radius - tolerance || hit.traveled! < traveled - tolerance) {
        throw new RangeError(`The outline of ${this.name} cuts into the passage, reaches past the center of a turn or doubles back ${station.along.toFixed(2)} m along it.`)
      }
      traveled = hit.traveled!
    }
  }

  /** The box around the floor plan of a stretch of a piece, from its lowest floor to its highest ceiling. */
  private chunk(piece: RoutePiece, from: number, to: number): RouteChunk {
    const points = this.footprint(piece, from, to)
    const ends = [from, to].map(offset => PassageRoute.station(piece, offset))
    return {
      min: [Math.min(...points.map(([x]) => x)), Math.min(...ends.map(({y}) => y)), Math.min(...points.map(([, z]) => z))],
      max: [Math.max(...points.map(([x]) => x)), Math.max(...ends.map(({y, height}) => y + height)), Math.max(...points.map(([, z]) => z))],
    }
  }

  /** Whether the box around the stretch keeps within `slack` of the passage’s walls. */
  private fits(piece: RoutePiece, from: number, to: number, slack: number) {
    const {min, max} = this.chunk(piece, from, to)
    const corners = [[min[0], min[2]], [max[0], min[2]], [min[0], max[2]], [max[0], max[2]]] as const
    // Each corner of the box, measured straight across from the route where it lies abreast of the stretch, or from the stretch’s nearer end
    for (const [x, z] of corners) {
      const {offset, right} = this.across(piece, x, z, (from + to) / 2)
      const station = PassageRoute.station(piece, clamp(offset, from, to))
      if (right > this.reach(station, 1) + slack || -right > this.reach(station, -1) + slack) {
        return false
      }
    }
    if (piece.kind === 'line') {
      return true
    }
    // Toward a turn’s center, the box may come closest to the wall along one of its edges.
    const [cx, cz] = piece.center
    const near = Math.sign(piece.sweep)
    const reach = Math.max(...[from, to, ...this.creases.map(along => along - piece.from).filter(offset => offset > from && offset < to)].map(offset => this.reach(PassageRoute.station(piece, offset), near)))
    const nearest = Math.hypot(clamp(cx, min[0], max[0]) - cx, clamp(cz, min[2], max[2]) - cz)
    return nearest >= piece.radius - reach - slack
  }

  /** Points around the floor plan of a stretch of a piece, out to the walls on both sides, including the outline’s corners along it and where a turn’s edge away from its center reaches furthest along x and z. */
  private footprint(piece: RoutePiece, from: number, to: number) {
    const points: Array<Point> = []
    for (const offset of [from, to]) {
      const station = PassageRoute.station(piece, offset)
      for (const side of [-1, 1]) {
        points.push(this.hit(station, side).point)
      }
    }
    const middle = piece.from + (from + to) / 2
    for (const side of [-1, 1]) {
      const outline = this.outlineAt(middle, side)
      if (outline) {
        points.push(...outline.corners.slice(1, -1).filter((_, index) => outline.creases[index] > piece.from + from && outline.creases[index] < piece.from + to))
      }
    }
    // A clockwise turn’s center lies on its right.
    if (piece.kind === 'arc' && !this.outlined(middle, -Math.sign(piece.sweep))) {
      const half = this.width / 2
      const start = piece.startAngle + piece.sweep * from / piece.length
      const end = piece.startAngle + piece.sweep * to / piece.length
      const [low, high] = start < end ? [start, end] : [end, start]
      for (let angle = Math.ceil(low / (Math.PI / 2)) * Math.PI / 2; angle <= high; angle += Math.PI / 2) {
        points.push([piece.center[0] + Math.cos(angle) * (piece.radius + half), piece.center[1] + Math.sin(angle) * (piece.radius + half)])
      }
    }
    return points
  }

  /** Where the line straight across from the station toward `side` meets that side’s walls. */
  private hit(station: RouteStation, side: number): SideHit {
    const [rx, rz] = rightOf(station.heading)
    const [dx, dz] = [rx * side, rz * side]
    const [px, pz] = station.point
    const outline = this.outlineAt(station.along, side)
    if (!outline) {
      const half = this.width / 2
      return {
        distance: half,
        point: [px + dx * half, pz + dz * half],
      }
    }
    const {corners} = outline
    let best: SideHit | undefined
    let traveled = 0
    for (const [segment, [ax, az]] of corners.slice(0, -1).entries()) {
      const [ex, ez] = [corners[segment + 1][0] - ax, corners[segment + 1][1] - az]
      const length = Math.hypot(ex, ez)
      // Solving station + distance · direction = corner + share · edge
      const denominator = dx * ez - dz * ex
      if (Math.abs(denominator) > 1e-12) {
        const [qx, qz] = [ax - px, az - pz]
        const distance = (qx * ez - qz * ex) / denominator
        const share = (qx * dz - qz * dx) / denominator
        if (distance > 0 && share > -tolerance && share < 1 + tolerance && (!best || distance < best.distance - 1e-12)) {
          best = {
            distance,
            point: [px + dx * distance, pz + dz * distance],
            segment,
            traveled: traveled + clamp(share, 0, 1) * length,
          }
        }
      }
      traveled += length
    }
    if (!best) {
      throw new RangeError(`No wall of the outline of ${this.name} lies straight across from ${station.along.toFixed(2)} m along it.`)
    }
    return best
  }

  /** The outline that stands in for the walls on `side` `along` meters down the route, if any. */
  private outlineAt(along: number, side: number) {
    return this.outlines.find(outline => outline.side === side && along >= outline.from - tolerance && along <= outline.to + tolerance)
  }

  /** Whether an outline stands in for the walls on `side` `along` meters down the route. */
  private outlined(along: number, side: number) {
    return this.outlineAt(along, side) !== undefined
  }

  /** The straight walls through the outline’s corners, standing level from their lowest floor, their baseboards following the floor wherever it changes along them. */
  private outlineWalls({corners, side, from, to}: PlacedOutline): Array<Omit<Wall, 'id'>> {
    // Where the floor meets the walls, straight across from every station along the stretch
    const contacts = this.stations(from, to).map(station => ({
      station,
      point: this.hit(station, side).point,
    }))
    return corners.slice(0, -1).map((start, segment) => {
      const end = corners[segment + 1]
      const [ex, ez] = [end[0] - start[0], end[1] - start[1]]
      const length = Math.hypot(ex, ez)
      const touching = contacts.filter(({point: [x, z]}) => {
        const share = ((x - start[0]) * ex + (z - start[1]) * ez) / length ** 2
        return share > -tolerance && share < 1 + tolerance && Math.abs((x - start[0]) * ez - (z - start[1]) * ex) / length < tolerance
      })
      const foot = Math.min(...touching.map(({station}) => station.y))
      const wall: Omit<Wall, 'id'> = {
        room: this.room,
        center: [(start[0] + end[0]) / 2, foot, (start[1] + end[1]) / 2],
        // It faces back across the passage, against the side it stands on.
        rotation: Math.atan2(side * ez, -side * ex),
        width: length,
        height: Math.max(...touching.map(({station}) => station.y + station.height)) - foot - 0.3,
        sticky: false,
        trimStyle: 'plain',
      }
      if (touching.every(({station}) => station.y === foot)) {
        return wall
      }
      const contact = touching.map(({station, point}): readonly [number, number] => [clamp(wallCoordinates(wall, [point[0], station.y, point[1]]), -length / 2, length / 2), station.y - foot]).toSorted((a, b) => a[0] - b[0])
      return {
        ...wall,
        // Only where the floor bends along the wall, and at its ends
        baseboardProfile: contact.filter(([, y], index) => index === 0 || index === contact.length - 1 || y !== contact[index - 1][1] || y !== contact[index + 1][1]),
      }
    })
  }

  /** The wall along one side of a piece, standing level from the piece’s lowest floor, without the profile its baseboard follows. */
  private plainWall(piece: RoutePiece, side: number): Omit<Wall, 'id'> {
    const half = this.width / 2
    // A ramp climbs or falls and grows taller or lower steadily, so the lowest floor and the highest crown lie at the piece’s ends.
    const foot = Math.min(piece.startY, piece.endY)
    const common = {
      room: this.room,
      height: Math.max(piece.startY + piece.startHeight, piece.endY + piece.endHeight) - foot - 0.3,
      sticky: false,
      trimStyle: 'plain',
    } as const
    if (piece.kind === 'line') {
      const middle = PassageRoute.station(piece, piece.length / 2)
      const [dx, dz] = [Math.cos(piece.heading), Math.sin(piece.heading)]
      return {
        ...common,
        center: [middle.point[0] - dz * side * half, foot, middle.point[1] + dx * side * half],
        // It faces back across the passage, against the side it stands on.
        rotation: Math.atan2(side * dz, -side * dx),
        width: piece.length,
      }
    }
    // A clockwise turn’s center lies on its right, where its wall runs closer to it.
    const radius = piece.radius - side * Math.sign(piece.sweep) * half
    const outer = radius > piece.radius
    const angle = piece.startAngle + piece.sweep / 2
    const [ux, uz] = [Math.cos(angle), Math.sin(angle)]
    // The outer wall faces the turn’s center, the inner one away from it.
    const [fx, fz] = outer ? [-ux, -uz] : [ux, uz]
    return {
      ...common,
      center: [piece.center[0] + ux * radius, foot, piece.center[1] + uz * radius],
      rotation: Math.atan2(fx, fz),
      width: radius * Math.abs(piece.sweep),
      curveRadius: outer ? radius : -radius,
    }
  }

  /** The stretch along the route the outline stands in for its side’s walls on, bounded by the joints its first and last corners lie straight across from. */
  private stretch(outline: RouteOutline) {
    const half = this.width / 2
    const joints = [0, ...this.route.pieces.map(piece => piece.from + piece.length)]
    const [from, to] = [outline.corners[0], outline.corners.at(-1)!].map(([x, z]) => {
      const projection = this.route.projections(x, z).find(({right}) => Math.abs(right - outline.side * half) < tolerance)
      const joint = projection && joints.find(along => Math.abs(along - projection.along) < tolerance)
      if (joint === undefined) {
        throw new RangeError(`The outline of ${this.name} starts and ends where the walls of its side stand, at joints between its route’s pieces or at its ends.`)
      }
      return joint
    })
    if (outline.corners.length < 2 || !(to > from)) {
      throw new RangeError(`The outline of ${this.name} runs on along its route through at least two corners.`)
    }
    return {
      ...outline,
      from,
      to,
    }
  }

  /** The wall along one side of a piece, `side` −1 on its left and 1 on its right, facing into the passage. Like a room’s, it stops 30 cm short of the ceiling, here the vault’s crown. */
  private wall(piece: RoutePiece, side: number): Omit<Wall, 'id'> {
    const wall = this.plainWall(piece, side)
    if (piece.startY === piece.endY) {
      return wall
    }
    // Where the floor meets the wall along its center line, at the piece’s ends and at every knot of its ramp in between
    const half = this.width / 2
    const contact = [0, ...PassageRoute.knots(piece), piece.length].map((offset): readonly [number, number] => {
      const {point: [x, z], heading, y} = PassageRoute.station(piece, offset)
      const u = wallCoordinates(wall, [x - Math.sin(heading) * side * half, y, z + Math.cos(heading) * side * half])
      return [Math.min(Math.max(u, -wall.width / 2), wall.width / 2), y - wall.center[1]]
    })
    return {
      ...wall,
      baseboardProfile: contact.toSorted((a, b) => a[0] - b[0]),
    }
  }
}
