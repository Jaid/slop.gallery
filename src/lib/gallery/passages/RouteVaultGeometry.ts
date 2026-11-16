import type {Vec3} from '../types.ts'
import type {RouteStation} from './PassageRoute.ts'
import type RoutedPassage from './RoutedPassage.ts'

import {ADDITION, Brush, Evaluator, SUBTRACTION} from 'three-bvh-csg'
import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, MeshBasicNodeMaterial, Shape, ShapeUtils, Vector2} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {wallPosition} from '../../placement/wallGeometry.ts'
import {openingShape} from '../architecture.ts'
import {vaultShellThickness} from '../architectureDimensions.ts'
import pavingColumns from './pavingColumns.ts'
import {routeRibDepth, routeRibThickness} from './RoutedPassage.ts'

export type PavingBox = {
  halfSize: [x: number, y: number, z: number]
  position: Vec3
  rotation: number
}

type Profile = ReadonlyArray<readonly [lateral: number, up: number]>
/** the cross section of a swept solid at a station, as faces in the order they follow around it, each a polyline from where the previous one ended; every station’s has as many points in each face */
type Section = (station: RouteStation, run: ReadonlyArray<RouteStation>) => ReadonlyArray<Profile>

/** how thick the slab of a routed passage’s paving is, under its floor */
export const pavingThickness = 0.24
/** An odd count leaves a level facet along the crown, wide enough for a lantern’s canopy to sit flush. */
const baseArchSegments = 15
const cinematicArchSegments = 33
/** Points around a half ellipse over the spring, `halfSpan` to either side of `middle` and `rise` high, from its left foot over its crown to its right foot, or back with `reverse`; as wide as it is high, it is a semicircle. */
function arch(middle: number, halfSpan: number, rise: number, spring: number, reverse = false, segments = baseArchSegments): Profile {
  const points = Array.from({length: segments + 1}, (_, i): readonly [number, number] => {
    const angle = Math.PI * (1 - i / segments)
    return [middle + Math.cos(angle) * halfSpan, spring + Math.sin(angle) * rise]
  })
  return reverse ? points.toReversed() : points
}
/**
 * A solid swept along stations of a route: each face of its cross section becomes a strip of its own, smooth along the route and across curved faces but creased between faces and at the stations where `runs` meet, and the first and the last station are capped unless `caps` omits an end.
 * The heights of the cross section stand over the floor or, `fromCrown`, over the passage’s crown.
 */
function sweep(runs: ReadonlyArray<ReadonlyArray<RouteStation>>, section: Section, fromCrown = false, oppositeDiagonals: ReadonlyArray<number> = [], caps: readonly [boolean, boolean] = [true, true]) {
  const place = ({point, heading, y, height}: RouteStation, [lateral, up]: readonly [number, number]) => [point[0] - Math.sin(heading) * lateral, y + (fromCrown ? height : 0) + up, point[1] + Math.cos(heading) * lateral] as const
  const outlineAt = (station: RouteStation, run: ReadonlyArray<RouteStation>) => section(station, run).flatMap(face => face.slice(1))
  const first = runs[0][0]
  const outline = outlineAt(first, runs[0])
  // Walking along the route with the cross section ordered counterclockwise, as seen from behind, each quad’s corners need this order to face outward.
  const area = outline.reduce((sum, [l, v], i) => {
    const [nextL, nextV] = outline[(i + 1) % outline.length]
    return sum + l * nextV - nextL * v
  }, 0)
  const flip = area < 0
  const parts = runs.flatMap(stations => {
    const sections = stations.map(station => section(station, stations))
    return sections[0].map((face, index) => {
      const positions: Array<number> = []
      for (const [row, station] of stations.entries()) {
        for (const point of sections[row][index]) {
          positions.push(...place(station, point))
        }
      }
      const indices: Array<number> = []
      const columns = face.length
      for (let row = 0; row < stations.length - 1; row++) {
        for (let column = 0; column < columns - 1; column++) {
          const a = row * columns + column
          const b = a + 1
          const c = a + columns
          const d = c + 1
          // Reversing a face’s columns (the slab’s underside) otherwise reverses its physical diagonal, making a twisted slab’s thickness vary between vertices.
          indices.push(...oppositeDiagonals.includes(index) ? (flip ? [a, b, d, a, d, c] : [a, d, b, a, c, d]) : (flip ? [a, b, c, b, d, c] : [a, c, b, b, c, d]))
        }
      }
      const strip = new BufferGeometry
      strip.setAttribute('position', new Float32BufferAttribute(positions, 3))
      strip.setIndex(indices)
      strip.computeVertexNormals()
      return strip
    })
  })
  for (const [index, station] of [first, runs.at(-1)!.at(-1)!].entries()) {
    if (!caps[index]) {
      continue
    }
    const ring = outlineAt(station, index ? runs.at(-1)! : runs[0])
    const triangles = ShapeUtils.triangulateShape(ring.map(([l, v]) => new Vector2(l, v)), [])
    const corners = ring.map(point => place(station, point))
    // The start’s cap looks back along the route, the end’s ahead.
    const facing = [Math.cos(station.heading) * (index ? 1 : -1), 0, Math.sin(station.heading) * (index ? 1 : -1)]
    const cap = new BufferGeometry
    cap.setAttribute('position', new Float32BufferAttribute(corners.flat(), 3))
    cap.setAttribute('normal', new Float32BufferAttribute(ring.flatMap(() => facing), 3))
    cap.setIndex(triangles.flatMap(([a, b, c]) => {
      const [u, v] = [b, c].map(corner => corners[corner].map((value, axis) => value - corners[a][axis]))
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      return normal[0] * facing[0] + normal[2] * facing[2] > 0 ? [a, b, c] : [a, c, b]
    }))
    parts.push(cap)
  }
  return parts
}
/** The paving with the holes broken through it, the passage’s pits or its drains, their outlines’ faces left standing as the edges of its slab. */
function breakPits(paving: BufferGeometry, passage: RoutedPassage, pits: ReadonlyArray<ReadonlyArray<readonly [number, number]>>) {
  if (!pits.length) {
    return paving
  }
  const evaluator = new Evaluator
  evaluator.useGroups = false
  // The swept strips carry no uvs; the paving’s material maps by world position.
  evaluator.attributes = ['position', 'normal']
  const material = new MeshBasicNodeMaterial
  const brushes: Array<Brush> = []
  const brush = (part: BufferGeometry) => {
    const result = new Brush(part, material)
    result.updateMatrixWorld(true)
    brushes.push(result)
    return result
  }
  let retained: BufferGeometry | undefined
  try {
    let result = brush(paving)
    for (const pit of pits) {
      const floors = pit.map(([x, z]) => passage.floorAt(x, z)!)
      const bottom = Math.min(...floors) - pavingThickness - 0.1
      // Drawn with its y turned to −z, it is extruded upward once it lies down.
      const outline = new ExtrudeGeometry(new Shape(pit.map(([x, z]) => new Vector2(x, -z))), {
        depth: Math.max(...floors) + 0.1 - bottom,
        bevelEnabled: false,
      })
      const cutter = brush(outline.rotateX(-Math.PI / 2).translate(0, bottom, 0))
      result = evaluator.evaluate(result, cutter, SUBTRACTION, brush(new BufferGeometry))
    }
    retained = result.geometry
    retained.computeBoundingBox()
    retained.computeBoundingSphere()
    return retained
  } finally {
    for (const item of brushes) {
      item.disposeCacheData()
      if (item.geometry !== retained) {
        item.geometry.dispose()
      }
    }
    material.dispose()
  }
}
/** The openings through the passage’s straight walls that reach up into its vault, past where it springs from them across their span; the vault passes over lower ones whole. */
function vaultOpenings(passage: RoutedPassage) {
  return passage.walls.flatMap(wall => {
    if (wall.curveRadius) {
      return []
    }
    return (wall.holes ?? []).filter(hole => {
      const springs = [-hole.width / 2, 0, hole.width / 2].flatMap(offset => {
        const [x, , z] = wallPosition(wall, hole.u + offset, 0, 0)
        const projected = passage.route.project(x, z)
        if (!projected) {
          return []
        }
        const station = passage.route.at(projected.along)
        return station.y + station.height - passage.width / 2
      })
      const spring = springs.length ? Math.min(...springs) : Math.min(...passage.route.pieces.map(piece => Math.min(piece.startY + piece.startHeight, piece.endY + piece.endHeight))) - passage.width / 2
      return wall.center[1] + hole.height > spring
    }).map(hole => ({
      wall,
      hole,
    }))
  })
}
/** Route intervals along `passage` that overlap any vault opening or abutment, merged with a half-meter margin so CSG only runs where needed. */
function cutIntervals(passage: RoutedPassage, openings: ReturnType<typeof vaultOpenings>) {
  const {route} = passage
  const raw: Array<{
    abutments: Array<typeof passage.abutments[number]>
    from: number
    openings: Array<typeof openings[number]>
    to: number
  }> = []
  const spanOf = (points: ReadonlyArray<readonly [number, number]>) => {
    const alongs = points.flatMap(([x, z]) => {
      const projected = route.project(x, z)
      return projected ? projected.along : []
    })
    if (!alongs.length) {
      return [0, route.length] as const
    }
    const from = Math.min(...alongs) - 0.5
    const to = Math.max(...alongs) + 0.5
    return [from < 0.5 ? 0 : from, to > route.length - 0.5 ? route.length : to] as const
  }
  for (const opening of openings) {
    const {wall, hole} = opening
    const corners = [-1, 1].map(side => {
      const [x, , z] = wallPosition(wall, hole.u + side * hole.width / 2, 0, 0)
      return [x, z] as const
    })
    const [from, to] = spanOf(corners)
    raw.push({
      from,
      to,
      openings: [opening],
      abutments: [],
    })
  }
  for (const abutment of passage.abutments) {
    const [px, , pz] = abutment.position
    const [sx, , sz] = abutment.size
    const corners = [-1, 1].flatMap(x => [-1, 1].map(z => [px + x * sx / 2, pz + z * sz / 2] as const))
    const [from, to] = spanOf(corners)
    raw.push({
      from,
      to,
      openings: [],
      abutments: [abutment],
    })
  }
  raw.sort((a, b) => a.from - b.from)
  const merged: typeof raw = []
  for (const item of raw) {
    const last = merged.at(-1)
    if (last && item.from <= last.to + 0.5) {
      last.to = Math.max(last.to, item.to)
      last.openings.push(...item.openings)
      last.abutments.push(...item.abutments)
    } else {
      merged.push(item)
    }
  }
  return merged
}
/**
 * Join overlapping solid vault envelopes before hollowing them out. Unioning thin shells against the same air surface leaves coplanar cuts that tear holes through the barrel.
 * Last, the back of the vault is cut away inside the passage’s abutments.
 */
function openVault(geometry: BufferGeometry, passage: RoutedPassage, air: BufferGeometry, openings: ReturnType<typeof vaultOpenings>, abutments: typeof passage.abutments, openCurveSegments: number) {
  if (!openings.length && !abutments.length) {
    air.dispose()
    return geometry
  }
  const extrude = ({wall, hole}: typeof openings[number], padding: number, back: number) => {
    const result = new ExtrudeGeometry(openingShape(hole, padding), {
      depth: passage.width / 2 - back,
      bevelEnabled: false,
      curveSegments: openCurveSegments,
    })
    return result.translate(0, 0, back).rotateY(wall.rotation).translate(...wall.center)
  }
  const evaluator = new Evaluator
  // Constrained triangulation preserves the intersection edges at the vault’s shallow angles.
  Object.assign(evaluator, {useCDTClipping: true})
  evaluator.useGroups = false
  evaluator.attributes = ['position', 'normal']
  const material = new MeshBasicNodeMaterial
  const brushes: Array<Brush> = []
  const brush = (part: BufferGeometry) => {
    const result = new Brush(part, material)
    result.updateMatrixWorld(true)
    brushes.push(result)
    return result
  }
  /** Joins small solids into one first, so the large vault takes a single operation for all of them: cutting it one after the other took the curve’s vault half a second longer. */
  const join = (parts: ReadonlyArray<BufferGeometry>) => parts.map(brush).reduce((joined, part) => evaluator.evaluate(joined, part, ADDITION, brush(new BufferGeometry)))
  let retained: BufferGeometry | undefined
  try {
    let result = brush(geometry)
    if (openings.length) {
      result = evaluator.evaluate(result, join(openings.map(opening => extrude(opening, vaultShellThickness, 0))), ADDITION, brush(new BufferGeometry))
    }
    result = evaluator.evaluate(result, brush(air), SUBTRACTION, brush(new BufferGeometry))
    const cutters = [
      ...openings.map(opening => extrude(opening, 0, -vaultShellThickness - 0.01)),
      ...abutments.map(({position, size}) => {
        const abutment = new BoxGeometry(...size)
        return abutment.translate(...position)
      }),
    ]
    result = evaluator.evaluate(result, join(cutters), SUBTRACTION, brush(new BufferGeometry))
    retained = result.geometry
    retained.computeBoundingBox()
    retained.computeBoundingSphere()
    return retained
  } finally {
    for (const item of brushes) {
      item.disposeCacheData()
      if (item.geometry !== retained) {
        item.geometry.dispose()
      }
    }
    material.dispose()
  }
}

/**
 * The stone barrel vault, its ribs and its paving swept along a {@link RoutedPassage}, in world space.
 * Like the straight passages’ vaults, the barrel springs from behind the walls’ faces, `width / 2` off the centerline, and its crown reaches the passage’s height, wherever that changes.
 * Where an outline widens the passage, the vault spans out to its walls as a half ellipse as high as the barrel, creased where the outline turns its corners, like a groin.
 */
export default class RouteVaultGeometry {
  /** the slab under the floor, flush with the passage’s walls, broken through by its pits and cut round its drains */
  readonly paving: BufferGeometry
  /** A level, rectangular tail after an inlet, colliding as one face rather than internal triangle edges under resting props. Excluded from `pavingCollision`. */
  readonly pavingBox?: PavingBox
  /** the paving’s collision mesh: broken through by pits but running on under drains, with any `pavingBox` tail left out */
  readonly pavingCollision: BufferGeometry
  readonly ribs: BufferGeometry
  readonly ribsCollision: BufferGeometry
  readonly shell: BufferGeometry
  readonly shellCollision: BufferGeometry

  constructor(passage: RoutedPassage, curveDetail = 1) {
    const {route, width} = passage
    const rise = width / 2
    // under the crown
    const spring = -rise
    /** The stations between two distances along the route, in runs that meet where the outline turns its corners. */
    const runs = (from: number, to: number, creases = passage.creases, stations: ReadonlyArray<RouteStation>) => {
      const result: Array<Array<RouteStation>> = [[]]
      for (const station of stations) {
        result.at(-1)!.push(station)
        if (creases.some(along => Math.abs(along - station.along) < 1e-9) && station.along > from && station.along < to) {
          result.push([station])
        }
      }
      return result
    }
    const vaultParts = (detail: number) => {
      const segments = detail > 1 ? cinematicArchSegments : baseArchSegments
      const turnStep = detail > 1 ? 1 / 32 : Math.PI / 20
      const rampSpacing = detail > 1 ? 0.25 : 0.8
      const openCurveSegments = detail > 1 ? 32 : 16
      /** The inner arch from the left wall to the right one, the right foot, the outer arch back and the left foot, `inner` and `outer` meters outside of the span between both walls. */
      const ring = (inner: number, outer: number): Section => station => {
        const [left, right] = [-1, 1].map(side => passage.reach(station, side))
        const middle = (right - left) / 2
        const half = (left + right) / 2
        return [
          arch(middle, half + inner, rise + inner, spring, false, segments),
          [[middle + half + inner, spring], [middle + half + outer, spring]],
          arch(middle, half + outer, rise + outer, spring, true, segments),
          [[middle - half - outer, spring], [middle - half - inner, spring]],
        ]
      }
      // The outer envelope stops at the spring; only the air extends down to the floor. Extending the outer solid down would backfill the passage’s separate walls and their windows.
      const solid = (from: number, to: number, padding: number, below?: number) => mergeParts(sweep(runs(from, to, passage.creases, passage.vaultStations(from, to, turnStep, rampSpacing)), station => {
        const [left, right] = [-1, 1].map(side => passage.reach(station, side))
        const foot = below === undefined ? spring : -station.height - below
        return [
          arch((right - left) / 2, (left + right) / 2 + padding, rise + padding, spring, false, segments),
          below === undefined ? [[right + padding, spring], [-left - padding, spring]] : [[right + padding, spring], [right + padding, foot], [-left - padding, foot], [-left - padding, spring]],
        ]
      }, true))
      const openings = vaultOpenings(passage)
      const intervals = cutIntervals(passage, openings)
      let shell: BufferGeometry
      if (!intervals.length) {
        shell = mergeParts(sweep(runs(0, route.length, passage.creases, passage.vaultStations(0, route.length, turnStep, rampSpacing)), ring(0, vaultShellThickness), true))
      } else {
        const shellParts: Array<BufferGeometry> = []
        let cursor = 0
        for (const {from, to, openings: intervalOpenings, abutments} of intervals) {
          if (from > cursor + 1e-6) {
            shellParts.push(...sweep(runs(cursor, from, passage.creases, passage.vaultStations(cursor, from, turnStep, rampSpacing)), ring(0, vaultShellThickness), true, [], [cursor === 0, false]))
          }
          const airFrom = from > 0 ? Math.max(0, from - width) : 0
          const airTo = to < route.length ? Math.min(route.length, to + width) : route.length
          shellParts.push(openVault(solid(from, to, vaultShellThickness), passage, solid(airFrom, airTo, 0, 0.5), intervalOpenings, abutments, openCurveSegments))
          cursor = to
        }
        if (cursor < route.length - 1e-6) {
          shellParts.push(...sweep(runs(cursor, route.length, passage.creases, passage.vaultStations(cursor, route.length, turnStep, rampSpacing)), ring(0, vaultShellThickness), true, [], [false, true]))
        }
        shell = mergeParts(shellParts)
      }
      const ribs = mergeParts(passage.ribs.flatMap(along => {
        const from = along - routeRibDepth / 2
        const to = along + routeRibDepth / 2
        const ribStations = [from, ...passage.creases.filter(c => c > from && c < to), to].map(value => route.at(value))
        return sweep(runs(from, to, passage.creases, ribStations), ring(-routeRibThickness, 0), true)
      }))
      return {
        shell,
        ribs,
      }
    }
    const base = vaultParts(1)
    this.shellCollision = base.shell
    this.ribsCollision = base.ribs
    if (curveDetail > 1) {
      const detailed = vaultParts(curveDetail)
      this.shell = detailed.shell
      this.ribs = detailed.ribs
    } else {
      this.shell = base.shell
      this.ribs = base.ribs
    }
    const floorCreases = [...passage.creases, ...passage.floorInlet ? [passage.floorInlet.inlet.length] : [], ...passage.floorOutlet ? [passage.floorOutlet.from] : []]
    const floorRuns = runs(0, route.length, floorCreases, passage.floorStations(0, route.length))
    const pavingSection: Section = (station, run) => {
      const [left, right] = [-1, 1].map(side => passage.reach(station, side))
      // Only the inlet needs extra columns; the rest keeps the ordinary paving tessellation.
      const inlet = passage.floorInlet && run[0].along < passage.floorInlet.inlet.length ? passage.floorInlet : undefined
      const outlet = passage.floorOutlet && run[0].along >= passage.floorOutlet.from - 1e-9 ? passage.floorOutlet : undefined
      const shaped = inlet || outlet
      const across = shaped?.across ?? pavingColumns(width, left, right, Boolean(passage.crossfall))
      const top = across.map(lateral => [lateral, passage.floorY(station, lateral) - station.y] as const)
      const leftY = top[0][1]
      const rightY = top.at(-1)![1]
      return [
        top,
        [[right, rightY], [right, rightY - pavingThickness]],
        // A joined floor keeps this thickness upstream too, so active crossfall cannot leave an open underside at the split.
        shaped || passage.floorOutlet ? top.toReversed().map(([lateral, y]) => [lateral, y - pavingThickness] as const) : [[right, -pavingThickness], [-left, -pavingThickness]],
        [[-left, leftY - pavingThickness], [-left, leftY]],
      ]
    }
    const makePaving = (pavingRuns: ReadonlyArray<ReadonlyArray<RouteStation>>) => breakPits(mergeParts(sweep(pavingRuns, pavingSection, false, passage.floorInlet || passage.floorOutlet ? [2] : [])), passage, passage.pits)
    const paving = makePaving(floorRuns)
    const tail = route.pieces.at(-1)!
    if (passage.floorInlet && !passage.pits.length && !passage.drains.length && tail.kind === 'line' && tail.from >= passage.floorInlet.inlet.length && tail.startY === tail.endY) {
      const middle = route.at(tail.from + tail.length / 2)
      this.pavingBox = {
        position: [middle.point[0], middle.y - pavingThickness / 2, middle.point[1]],
        rotation: -tail.heading,
        halfSize: [tail.length / 2, pavingThickness / 2, width / 2],
      }
      // Coplanar triangles without edge repair made resting armor sensitive to the distant inlet’s triangle order. One face under the level tail has no internal edges.
      this.pavingCollision = makePaving(runs(0, tail.from, floorCreases, passage.floorStations(0, tail.from)))
    } else {
      this.pavingCollision = paving
    }
    this.paving = passage.drains.length ? breakPits(paving.clone(), passage, passage.drains) : paving
  }

  dispose() {
    this.shell.dispose()
    this.ribs.dispose()
    if (this.shellCollision !== this.shell) {
      this.shellCollision.dispose()
    }
    if (this.ribsCollision !== this.ribs) {
      this.ribsCollision.dispose()
    }
    this.paving.dispose()
    if (this.pavingCollision !== this.paving) {
      this.pavingCollision.dispose()
    }
  }
}
