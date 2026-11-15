import type {FloorBlendProfile} from './base/PassageFloorBlend.ts'
import type PassageRoute from './PassageRoute.ts'
import type {RouteStation} from './PassageRoute.ts'

import {clamp} from 'math'

import {easedRampKnots} from '../easedRamp.ts'
import PassageFloorBlend from './base/PassageFloorBlend.ts'

/** A passage’s floor at its end, sampled from the floor it meets, easing out of its own floor over `length` meters along every lane. */
export type FloorOutlet = FloorBlendProfile

const turnStep = 1 / 32
const knotSpacing = 0.06
const minStationGap = 1e-3
/** Quintic easing with zero slope and zero curvature at both ends, so the outlet arrives flat at the adjoining floor without a ridge. */
const smootherstep = (s: number) => {
  const t = clamp(s, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const laneScale = (piece: PassageRoute['pieces'][number], right: number) => (piece.kind === 'line' ? 1 : Math.min(1, (piece.radius - Math.sign(piece.sweep) * right) / piece.radius))
/** Horizontal arc-length distance from the route’s end back to `along` along the lateral lane `right` meters right of the centerline, capped at centerline distance on outer turns so outer walls stay monotonically higher than the floor beside them. */
function laneDistanceFromEnd(route: PassageRoute, along: number, right: number) {
  let distance = 0
  for (let i = route.pieces.length - 1; i >= 0; i--) {
    const piece = route.pieces[i]
    const end = piece.from + piece.length
    if (along >= end) {
      break
    }
    const start = Math.max(piece.from, along)
    distance += (end - start) * laneScale(piece, right)
    if (along >= piece.from) {
      break
    }
  }
  return distance
}
/** Distance along the centerline where the lateral lane `right` is `distance` meters short of the route’s end, or −1 if the lane is shorter than `distance`. */
function alongAtLaneDistance(route: PassageRoute, distance: number, right: number) {
  let remaining = distance
  for (let i = route.pieces.length - 1; i >= 0; i--) {
    const piece = route.pieces[i]
    const scale = laneScale(piece, right)
    const laneSpan = piece.length * scale
    if (remaining <= laneSpan + 1e-12) {
      return Math.max(0, piece.from + piece.length - remaining / scale)
    }
    remaining -= laneSpan
  }
  return -1
}

/**
 * A floor that eases out of a passage’s own floor (including any crossfall) to match an adjoining floor profile at its end, measured along each lateral lane so tight inner turns blend smoothly back along the approach instead of spiking on the corner. The vault stays on the original route.
 */
export default class PassageFloorOutlet extends PassageFloorBlend {
  readonly along: ReadonlyArray<number>
  /** distance along the centerline where the outlet blend begins */
  readonly fromAlong: number
  protected readonly rows: ReadonlyArray<ReadonlyArray<number>>

  constructor(readonly route: PassageRoute, width: number, readonly outlet: FloorOutlet, private readonly baseline: (station: RouteStation, right: number) => number, extraAlong: ReadonlyArray<number> = []) {
    super(width, outlet)
    const {length, profile} = outlet
    const fromLeft = alongAtLaneDistance(route, length, -width / 2)
    const fromRight = alongAtLaneDistance(route, length, width / 2)
    if (fromLeft < 0 || fromRight < 0) {
      throw new RangeError('A floor outlet needs a route at least as long as its blend along both walls.')
    }
    this.fromAlong = Math.min(fromLeft, fromRight)
    const knots = easedRampKnots(length, knotSpacing)
    const laneKnots = [-width / 2, 0, width / 2].flatMap(right => knots.map(distance => alongAtLaneDistance(route, distance, right)).filter(along => along >= this.fromAlong))
    const raw = [
      this.fromAlong,
      ...route.stations(this.fromAlong, route.length, turnStep).map(station => station.along),
      ...laneKnots,
      ...extraAlong.filter(along => along > this.fromAlong && along < route.length),
      route.length,
    ].toSorted((a, b) => a - b)
    const deduplicated: Array<number> = []
    for (const value of raw) {
      if (!deduplicated.length || value - deduplicated.at(-1)! > minStationGap && route.length - value > minStationGap || value === route.length && deduplicated.at(-1)! < route.length) {
        deduplicated.push(value)
      }
    }
    this.along = deduplicated
    this.rows = this.along.map(along => {
      const station = route.at(along)
      return profile.map(([right, outletY]) => {
        const distance = laneDistanceFromEnd(route, along, right)
        const base = baseline(station, right)
        if (distance >= length) {
          return base
        }
        const blend = smootherstep(distance / length)
        return outletY * (1 - blend) + base * blend
      })
    })
  }

  /** The height on the paving’s triangles within the outlet blend, or the passage’s own floor before it. */
  height(along: number, right: number) {
    if (along <= this.fromAlong) {
      return this.baseline(this.route.at(along), right)
    }
    return this.interpolate(Math.min(along, this.route.length), right)
  }
}
