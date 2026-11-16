import easedRamp, {easedRampKnots} from '../easedRamp.ts'

/** a straight run of a route */
export type RouteRun = {
  length: number
}

/** a circular turn of a route by `angle` radians around a center `radius` meters off its centerline; positive angles turn clockwise as seen from above, from north toward east */
export type RouteTurn = {
  angle: number
  radius: number
}
/**
 * Runs and turns along which the floor climbs or falls to the height `y` and the passage grows taller or lower to `height`, either staying as it was if left out.
 * Both ease in and out over the ramp’s whole length, like the Oculus’ tower ramp and bridges, however many runs and turns it takes; outside of ramps, the route stays level and as tall.
 */
export type RouteRamp = {
  height?: number
  steps: ReadonlyArray<RouteRun | RouteTurn>
  y?: number
}
export type RouteStep = RouteRamp | RouteRun | RouteTurn
/** the stretch of a route a ramp eases along: where it starts and how long it is, and the floor’s and the passage’s heights at both of its ends */
export type RampSpan = {
  endHeight: number
  endY: number
  from: number
  length: number
  startHeight: number
  startY: number
}
/** a straight run from `start` along `heading` */
export type RouteLine = PieceBase & {
  heading: number
  kind: 'line'
  start: Point
}

/** a turn around `center`, starting at polar angle `startAngle` and sweeping by the signed `sweep` */
export type RouteArc = PieceBase & {
  center: Point
  kind: 'arc'
  radius: number
  startAngle: number
  sweep: number
}
export type RoutePiece = RouteArc | RouteLine
/** a point on a route’s centerline, `along` meters down it, with the direction it runs in there, the floor’s height and how tall the passage is over it, from its floor to its crown */
export type RouteStation = {
  along: number
  /** the angle of the direction of travel in the floor plan, atan2 of its z and x */
  heading: number
  height: number
  point: Point
  y: number
}
/** where a point of the floor plan lies relative to a route: how far along it, and how far to the right of its centerline */
export type RouteProjection = {
  along: number
  piece: RoutePiece
  right: number
}
type Point = readonly [x: number, z: number]
type PieceBase = {
  /** how tall the passage is where the piece ends */
  endHeight: number
  /** the floor height where the piece ends */
  endY: number
  /** how far along the route the piece starts */
  from: number
  /** its length along the centerline */
  length: number
  /** the ramp the piece is part of, if it is */
  ramp?: RampSpan
  /** how tall the passage is where the piece starts */
  startHeight: number
  /** the floor height where the piece starts */
  startY: number
}
type Profile = Pick<PieceBase, 'endHeight' | 'endY' | 'ramp' | 'startHeight' | 'startY'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const tolerance = 1e-9
const direction = (heading: number): Point => [Math.cos(heading), Math.sin(heading)]
/** the direction to the right of a heading, seen from above with north up */
const rightOf = (heading: number): Point => [-Math.sin(heading), Math.cos(heading)]
/** the floor’s height and the passage’s height `along` meters into a ramp, eased between its ends and exactly theirs at them */
const rampLevels = (ramp: RampSpan, along: number) => {
  const climbed = easedRamp(along, ramp.length)
  return {
    y: ramp.startY * (1 - climbed) + ramp.endY * climbed,
    height: ramp.startHeight * (1 - climbed) + ramp.endHeight * climbed,
  }
}

/**
 * The centerline of a passage, laid out like a turtle walks: from a start point and heading, through straight runs and circular turns that each continue the last one’s direction.
 * Its floor height starts at `y` and its height at `height`; both change only along ramps, see {@link RouteRamp}.
 */
export default class PassageRoute {
  /** Where the profile of a piece bends between its ends: the knots of the ramp it is part of, in meters into the piece. Between them, and between them and its ends, the floor and the crown run straight. */
  static knots(piece: RoutePiece, spacing?: number) {
    const {ramp} = piece
    if (!ramp) {
      return []
    }
    return easedRampKnots(ramp.length, spacing).map(knot => ramp.from + knot - piece.from).filter(offset => offset > tolerance && offset < piece.length - tolerance)
  }

  /** Where the point lies relative to the piece, or undefined beside its span. */
  static projectOnto(piece: RoutePiece, x: number, z: number): RouteProjection | undefined {
    if (piece.kind === 'line') {
      const [dx, dz] = direction(piece.heading)
      const [rx, rz] = rightOf(piece.heading)
      const offset = (x - piece.start[0]) * dx + (z - piece.start[1]) * dz
      if (offset < -tolerance || offset > piece.length + tolerance) {
        return
      }
      return {
        piece,
        along: piece.from + Math.min(Math.max(offset, 0), piece.length),
        right: (x - piece.start[0]) * rx + (z - piece.start[1]) * rz,
      }
    }
    const distance = Math.hypot(x - piece.center[0], z - piece.center[1])
    // How far the point has come around the center, in the direction the arc sweeps.
    const turned = Math.sign(piece.sweep) * (Math.atan2(z - piece.center[1], x - piece.center[0]) - piece.startAngle)
    const swept = (turned % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const sweep = Math.abs(piece.sweep)
    // Just before the start, the angle wraps around to almost a full turn.
    const angle = swept > Math.PI * 2 - tolerance ? 0 : swept
    if (angle > sweep + tolerance / piece.radius) {
      return
    }
    return {
      piece,
      along: piece.from + Math.min(angle, sweep) * piece.radius,
      // A clockwise turn has its center on the right.
      right: Math.sign(piece.sweep) * (piece.radius - distance),
    }
  }

  /** The station `offset` meters into a piece. */
  static station(piece: RoutePiece, offset: number): RouteStation {
    const fraction = piece.length ? offset / piece.length : 0
    const {y, height} = piece.ramp ? rampLevels(piece.ramp, piece.from + offset - piece.ramp.from) : {
      y: piece.startY,
      height: piece.startHeight,
    }
    if (piece.kind === 'line') {
      const [dx, dz] = direction(piece.heading)
      return {
        along: piece.from + offset,
        point: [piece.start[0] + dx * offset, piece.start[1] + dz * offset],
        heading: piece.heading,
        y,
        height,
      }
    }
    const angle = piece.startAngle + piece.sweep * fraction
    return {
      along: piece.from + offset,
      point: [piece.center[0] + Math.cos(angle) * piece.radius, piece.center[1] + Math.sin(angle) * piece.radius],
      heading: angle + Math.sign(piece.sweep) * Math.PI / 2,
      y,
      height,
    }
  }

  /** the floor height and direction where the route ends */
  readonly end: RouteStation
  readonly length: number
  readonly pieces: ReadonlyArray<RoutePiece>

  constructor(readonly start: Point, readonly heading: number, readonly y: number, readonly height: number, readonly steps: ReadonlyArray<RouteStep>) {
    if (!steps.length || ![...start, heading, y].every(Number.isFinite) || !(height > 0)) {
      throw new RangeError('A route needs a finite start, heading and floor height, a positive height and at least one step.')
    }
    const pieces: Array<RoutePiece> = []
    let point = start
    let current = heading
    let along = 0
    /** Lays out a run or a turn where the last one ended, without its profile. */
    const lay = (step: RouteRun | RouteTurn): DistributiveOmit<RoutePiece, keyof Profile> => {
      if ('length' in step) {
        if (!(step.length > 0)) {
          throw new RangeError('A route’s runs need a positive length.')
        }
        const piece = {
          kind: 'line',
          start: point,
          heading: current,
          from: along,
          length: step.length,
        } as const
        const [dx, dz] = direction(current)
        point = [point[0] + dx * step.length, point[1] + dz * step.length]
        along += step.length
        return piece
      }
      if (!(step.radius > 0) || !Number.isFinite(step.angle) || Math.abs(step.angle) < tolerance || Math.abs(step.angle) > Math.PI * 2) {
        throw new RangeError('A route’s turns need a positive radius and a finite angle of at most one revolution.')
      }
      const side = Math.sign(step.angle)
      const [rx, rz] = rightOf(current)
      const center: Point = [point[0] + rx * side * step.radius, point[1] + rz * side * step.radius]
      const startAngle = Math.atan2(point[1] - center[1], point[0] - center[0])
      const length = Math.abs(step.angle) * step.radius
      const piece = {
        kind: 'arc',
        center,
        radius: step.radius,
        startAngle,
        sweep: step.angle,
        from: along,
        length,
      } as const
      point = [center[0] + Math.cos(startAngle + step.angle) * step.radius, center[1] + Math.sin(startAngle + step.angle) * step.radius]
      current += step.angle
      along += length
      return piece
    }
    let floor = y
    let tall = height
    for (const step of steps) {
      if (!('steps' in step)) {
        pieces.push({
          ...lay(step),
          startY: floor,
          endY: floor,
          startHeight: tall,
          endHeight: tall,
        })
        continue
      }
      const endY = step.y ?? floor
      const endHeight = step.height ?? tall
      if (!step.steps.length || !Number.isFinite(endY) || !(endHeight > 0)) {
        throw new RangeError('A route’s ramps need at least one run or turn, a finite floor height and a positive height.')
      }
      const from = along
      const laid = step.steps.map(lay)
      const ramp: RampSpan = {
        from,
        length: along - from,
        startY: floor,
        endY,
        startHeight: tall,
        endHeight,
      }
      for (const piece of laid) {
        const [first, last] = [piece.from, piece.from + piece.length].map(offset => rampLevels(ramp, offset - from))
        pieces.push({
          ...piece,
          ramp,
          startY: first.y,
          endY: last.y,
          startHeight: first.height,
          endHeight: last.height,
        })
      }
      floor = endY
      tall = endHeight
    }
    this.pieces = pieces
    this.length = along
    this.end = {
      along,
      point,
      heading: current,
      y: floor,
      height: tall,
    }
  }

  /** The station `along` meters down the route, clamped to its ends. */
  at(along: number): RouteStation {
    const distance = Math.min(Math.max(along, 0), this.length)
    const piece = this.pieces.find(value => distance <= value.from + value.length + tolerance) ?? this.pieces.at(-1)!
    return PassageRoute.station(piece, distance - piece.from)
  }

  /** Where the point lies relative to the nearest piece whose span it lies beside, or undefined beside none of them. */
  project(x: number, z: number): RouteProjection | undefined {
    let best: RouteProjection | undefined
    for (const projection of this.projections(x, z)) {
      if (!best || Math.abs(projection.right) < Math.abs(best.right)) {
        best = projection
      }
    }
    return best
  }

  /** Where the point lies relative to each piece whose span it lies beside, in the route’s order. */
  projections(x: number, z: number) {
    return this.pieces.flatMap(piece => PassageRoute.projectOnto(piece, x, z) ?? [])
  }

  /** Stations between two distances along the route: where they start and end, at every joint between its pieces, at every knot of its ramps and in steps of at most `turnStep` radians around its turns. */
  stations(from: number, to: number, turnStep: number, rampSpacing?: number) {
    const stations: Array<RouteStation> = []
    for (const piece of this.pieces) {
      const start = Math.max(from, piece.from) - piece.from
      const end = Math.min(to, piece.from + piece.length) - piece.from
      if (end <= start) {
        continue
      }
      const steps = piece.kind === 'arc' ? Math.max(1, Math.ceil(Math.abs(piece.sweep) * (end - start) / piece.length / turnStep)) : 1
      const offsets = Array.from({length: steps + 1}, (_, step) => start + (end - start) * step / steps)
      // Knots that all but coincide with a step would only leave slivers.
      const knots = PassageRoute.knots(piece, rampSpacing).filter(knot => knot > start && knot < end && offsets.every(offset => Math.abs(offset - knot) > 1e-6))
      for (const offset of [...offsets, ...knots].toSorted((a, b) => a - b).slice(stations.length ? 1 : 0)) {
        stations.push(PassageRoute.station(piece, offset))
      }
    }
    return stations
  }
}
