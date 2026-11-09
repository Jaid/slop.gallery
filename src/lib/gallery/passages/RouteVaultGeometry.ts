import type {RouteStation} from './PassageRoute.ts'
import type RoutedPassage from './RoutedPassage.ts'

import {ADDITION, Brush, Evaluator, SUBTRACTION} from 'three-bvh-csg'
import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, MeshBasicNodeMaterial, Shape, ShapeUtils, Vector2} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {openingShape} from '../architecture.ts'
import {vaultShellThickness} from '../architectureDimensions.ts'
import {routeRibDepth, routeRibThickness} from './RoutedPassage.ts'

type Profile = ReadonlyArray<readonly [lateral: number, up: number]>
/** the cross section of a swept solid at a station, as faces in the order they follow around it, each a polyline from where the previous one ended; every station’s has as many points in each face */
type Section = (station: RouteStation) => ReadonlyArray<Profile>

/** how thick the slab of a routed passage’s paving is, under its floor */
export const pavingThickness = 0.24
/** how wide the strips its paving is cut into across at most, in meters */
const pavingStrip = 0.25
/** An odd count leaves a level facet along the crown, wide enough for a lantern’s canopy to sit flush. */
const archSegments = 33
/** Points around a half ellipse over the spring, `halfSpan` to either side of `middle` and `rise` high, from its left foot over its crown to its right foot, or back with `reverse`; as wide as it is high, it is a semicircle. */
function arch(middle: number, halfSpan: number, rise: number, spring: number, reverse = false): Profile {
  const points = Array.from({length: archSegments + 1}, (_, i): readonly [number, number] => {
    const angle = Math.PI * (1 - i / archSegments)
    return [middle + Math.cos(angle) * halfSpan, spring + Math.sin(angle) * rise]
  })
  return reverse ? points.toReversed() : points
}
/**
 * A solid swept along stations of a route: each face of its cross section becomes a strip of its own, smooth along the route and across curved faces but creased between faces and at the stations where `runs` meet, and the first and the last station are capped.
 * The heights of the cross section stand over the floor or, `fromCrown`, over the passage’s crown.
 */
function sweep(runs: ReadonlyArray<ReadonlyArray<RouteStation>>, section: Section, fromCrown = false) {
  const place = ({point, heading, y, height}: RouteStation, [lateral, up]: readonly [number, number]) => [point[0] - Math.sin(heading) * lateral, y + (fromCrown ? height : 0) + up, point[1] + Math.cos(heading) * lateral] as const
  const outlineAt = (station: RouteStation) => section(station).flatMap(face => face.slice(1))
  const first = runs[0][0]
  const outline = outlineAt(first)
  // Walking along the route with the cross section ordered counterclockwise, as seen from behind, each quad’s corners need this order to face outward.
  const area = outline.reduce((sum, [l, v], i) => {
    const [nextL, nextV] = outline[(i + 1) % outline.length]
    return sum + l * nextV - nextL * v
  }, 0)
  const flip = area < 0
  const parts = runs.flatMap(stations => {
    const sections = stations.map(section)
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
          indices.push(...flip ? [a, b, c, b, d, c] : [a, c, b, b, c, d])
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
    const ring = outlineAt(station)
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
/** The openings through the passage’s straight walls that reach up into its vault, past where it springs from them anywhere along the route; the vault passes over lower ones whole. */
function vaultOpenings(passage: RoutedPassage) {
  const spring = Math.min(...passage.route.pieces.map(piece => Math.min(piece.startY + piece.startHeight, piece.endY + piece.endHeight))) - passage.width / 2
  return passage.walls.flatMap(wall => (wall.curveRadius ? [] : (wall.holes ?? []).filter(hole => wall.center[1] + hole.height > spring).map(hole => ({
    wall,
    hole,
  }))))
}
/**
 * Join overlapping solid vault envelopes before hollowing them out. Unioning thin shells against the same air surface leaves coplanar cuts that tear holes through the barrel.
 * Last, the back of the vault is cut away inside the passage’s abutments.
 */
function openVault(geometry: BufferGeometry, passage: RoutedPassage, air: BufferGeometry) {
  const openings = vaultOpenings(passage)
  if (!openings.length && !passage.abutments.length) {
    air.dispose()
    return geometry
  }
  const extrude = ({wall, hole}: typeof openings[number], padding: number, back: number) => {
    const result = new ExtrudeGeometry(openingShape(hole, padding), {
      depth: passage.width / 2 - back,
      bevelEnabled: false,
      curveSegments: 32,
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
      ...passage.abutments.map(({position, size}) => {
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
  /** what collides of the paving: broken through by its pits, but running on under its drains’ grates; the paving itself without drains */
  readonly pavingCollision: BufferGeometry
  readonly ribs: BufferGeometry
  readonly shell: BufferGeometry

  constructor(passage: RoutedPassage) {
    const {route, width} = passage
    const rise = width / 2
    // under the crown
    const spring = -rise
    /** The stations between two distances along the route, in runs that meet where the outline turns its corners. */
    const runs = (from: number, to: number) => {
      const result: Array<Array<RouteStation>> = [[]]
      for (const station of passage.stations(from, to)) {
        result.at(-1)!.push(station)
        if (passage.creases.some(along => Math.abs(along - station.along) < 1e-9) && station.along > from && station.along < to) {
          result.push([station])
        }
      }
      return result
    }
    /** The inner arch from the left wall to the right one, the right foot, the outer arch back and the left foot, `inner` and `outer` meters outside of the span between both walls. */
    const ring = (inner: number, outer: number): Section => station => {
      const [left, right] = [-1, 1].map(side => passage.reach(station, side))
      const middle = (right - left) / 2
      const half = (left + right) / 2
      return [
        arch(middle, half + inner, rise + inner, spring),
        [[middle + half + inner, spring], [middle + half + outer, spring]],
        arch(middle, half + outer, rise + outer, spring, true),
        [[middle - half - outer, spring], [middle - half - inner, spring]],
      ]
    }
    // The outer envelope stops at the spring; only the air extends down to the floor. Extending the outer solid down would backfill the passage’s separate walls and their windows.
    const solid = (padding: number, below?: number) => mergeParts(sweep(runs(0, route.length), station => {
      const [left, right] = [-1, 1].map(side => passage.reach(station, side))
      const foot = below === undefined ? spring : -station.height - below
      return [
        arch((right - left) / 2, (left + right) / 2 + padding, rise + padding, spring),
        below === undefined ? [[right + padding, spring], [-left - padding, spring]] : [[right + padding, spring], [right + padding, foot], [-left - padding, foot], [-left - padding, spring]],
      ]
    }, true))
    const hasOpenings = vaultOpenings(passage).length > 0 || passage.abutments.length > 0
    this.shell = hasOpenings ? openVault(solid(vaultShellThickness), passage, solid(0, 0.5)) : mergeParts(sweep(runs(0, route.length), ring(0, vaultShellThickness), true))
    this.ribs = mergeParts(passage.ribs.flatMap(along => sweep(runs(along - routeRibDepth / 2, along + routeRibDepth / 2), ring(-routeRibThickness, 0), true)))
    /** how many strips the paving is cut into from either wall to the centerline, at most `pavingStrip` wide, so it bends with its crossfall and stays close to flat through the twist of a ramp round a turn */
    const strips = Math.ceil(width / 2 / pavingStrip)
    const paving = breakPits(mergeParts(sweep(runs(0, route.length), station => {
      const [left, right] = [-1, 1].map(side => passage.reach(station, side))
      const across = [
        ...Array.from({length: strips + 1}, (_, index) => -left + left * index / strips),
        ...Array.from({length: strips}, (_, index) => right * (index + 1) / strips),
      ]
      return [
        across.map(lateral => [lateral, -passage.sag(station, lateral)] as const),
        [[right, 0], [right, -pavingThickness]],
        [[right, -pavingThickness], [-left, -pavingThickness]],
        [[-left, -pavingThickness], [-left, 0]],
      ]
    })), passage, passage.pits)
    this.pavingCollision = paving
    this.paving = passage.drains.length ? breakPits(paving.clone(), passage, passage.drains) : paving
  }

  dispose() {
    this.shell.dispose()
    this.ribs.dispose()
    this.paving.dispose()
    this.pavingCollision.dispose()
  }
}
