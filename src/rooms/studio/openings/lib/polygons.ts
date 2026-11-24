import type {PathD, PathsD, PointD, PolyPathD} from 'clipper2-ts'

import {areaD, booleanOpDWithPolyTree, ClipType, differenceD, EndType, FillRule, getBoundsPathsD, inflatePathsD, intersectD, JoinType, pointInPolygonD, PointInPolygonResult, PolyTreeD, unionD} from 'clipper2-ts'

import {circleSegments} from '#src/lib/geometry.ts'

/** a closed outline in the ceiling’s plane, in meters, its x along the room’s x and its y along the room’s z */
export type Polygon = PathD
export type Polygons = PathsD
/** a point in the ceiling’s plane */
export type Point = PointD

/** the decimal places Clipper rounds to: a tenth of a millimeter */
const precision = 4
/** how far a round edge may stray from its circle, in meters */
const roundTolerance = 0.0015

export const point = (x: number, y: number): Point => ({
  x,
  y,
})

/** an outline with the holes inside it */
export type Shape = {
  holes: Polygons
  outline: Polygon
}

/** The corners of an arc of `radius` round `center` from angle `from` to angle `to`, both ends included, in radians counterclockwise from +x. */
export function arc(center: Point, radius: number, from: number, to: number): Polygon {
  const segments = Math.max(2, Math.ceil(circleSegments(radius, roundTolerance) * Math.abs(to - from) / (Math.PI * 2)))
  return Array.from({length: segments + 1}, (_, index) => {
    const angle = from + (to - from) * index / segments
    return point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius)
  })
}

export function circle(center: Point, radius: number): Polygon {
  return arc(center, radius, 0, Math.PI * 2).slice(0, -1)
}

export function ellipse(center: Point, radiusX: number, radiusY: number): Polygon {
  return circle(point(0, 0), Math.max(radiusX, radiusY)).map(({x, y}) => {
    const scale = Math.max(radiusX, radiusY)
    return point(center.x + x / scale * radiusX, center.y + y / scale * radiusY)
  })
}

/** A regular polygon round `center`, its corners `radius` out, the first at `rotation` radians. */
export function regular(sides: number, radius: number, rotation = 0, center = point(0, 0)): Polygon {
  return Array.from({length: sides}, (_, index) => {
    const angle = rotation + index / sides * Math.PI * 2
    return point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius)
  })
}

/** A star of `spikes` spikes round `center`, its tips `outer` out and the corners between them `inner` out, the first tip at `rotation` radians. */
export function star(spikes: number, outer: number, inner: number, rotation = 0, center = point(0, 0)): Polygon {
  return Array.from({length: spikes * 2}, (_, index) => {
    const angle = rotation + index / spikes * Math.PI
    const radius = index % 2 ? inner : outer
    return point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius)
  })
}

export function rectangle(center: Point, width: number, height: number, rotation = 0): Polygon {
  return rotate([[
    point(-width / 2, -height / 2),
    point(width / 2, -height / 2),
    point(width / 2, height / 2),
    point(-width / 2, height / 2),
  ]], rotation, center)[0]
}

/** The outlines turned `angle` radians counterclockwise round the origin, then moved by `by`. */
export function rotate(polygons: Polygons, angle: number, by = point(0, 0)): Polygons {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  return polygons.map(polygon => polygon.map(({x, y}) => point(by.x + x * cos - y * sin, by.y + x * sin + y * cos)))
}

export function translate(polygons: Polygons, by: Point): Polygons {
  return polygons.map(polygon => polygon.map(({x, y}) => point(x + by.x, y + by.y)))
}

/** The outlines with every corner rounded off by `radius`. */
export function round(polygons: Polygons, radius: number): Polygons {
  return inflatePathsD(inset(polygons, radius), radius, JoinType.Round, EndType.Polygon, 2, precision, roundTolerance)
}

/** The outlines shrunk by `distance` all round, their corners kept sharp; whatever is narrower than twice that vanishes. */
export function inset(polygons: Polygons, distance: number): Polygons {
  return inflatePathsD(polygons, -distance, JoinType.Miter, EndType.Polygon, 2, precision)
}

/** The outlines without their parts narrower than `width`, like the thinning tips of a crescent. */
export function trim(polygons: Polygons, width: number): Polygons {
  return intersect(polygons, inflatePathsD(inset(polygons, width / 2), width / 2, JoinType.Round, EndType.Polygon, 2, precision, roundTolerance))
}

/** Bars `width` wide along the closed outlines, as outlines of their own. */
export function stroke(polygons: Polygons, width: number): Polygons {
  return inflatePathsD(polygons, width / 2, JoinType.Miter, EndType.Joined, 2, precision)
}

export function intersect(subject: Polygons, clip: Polygons): Polygons {
  return intersectD(subject, clip, FillRule.NonZero, precision)
}

export function unite(polygons: Polygons): Polygons {
  return unionD(polygons, [], FillRule.NonZero, precision)
}

export function subtract(subject: Polygons, clip: Polygons): Polygons {
  return differenceD(subject, clip, FillRule.NonZero, precision)
}

/** The subject less the clip, as shapes: every outline with the holes it encloses, and anything inside a hole as a shape of its own. */
export function subtractShapes(subject: Polygons, clip: Polygons): Array<Shape> {
  const tree = new PolyTreeD
  booleanOpDWithPolyTree(ClipType.Difference, subject, clip, tree, FillRule.NonZero, precision)
  const shapes: Array<Shape> = []
  const children = (node: PolyPathD) => Array.from({length: node.count}, (_, index) => node.child(index))
  const collect = (node: PolyPathD) => {
    for (const outer of children(node)) {
      const holes = children(outer)
      shapes.push({
        outline: outer.poly!,
        holes: holes.map(hole => hole.poly!),
      })
      for (const hole of holes) {
        collect(hole)
      }
    }
  }
  collect(tree)
  return shapes
}

/** How much the outlines enclose, counting each the same whichever way it runs. */
export function area(polygons: Polygons) {
  return polygons.reduce((sum, polygon) => sum + Math.abs(areaD(polygon)), 0)
}

/** How far the outlines reach from the origin along x and along y, whichever way. */
export function reach(polygons: Polygons) {
  const {top, bottom, left, right} = getBoundsPathsD(polygons)
  return {
    x: Math.max(-left, right),
    y: Math.max(-top, bottom),
  }
}

/** Whether the point lies inside any of the outlines. */
export function contains(polygons: Polygons, inside: Point) {
  return polygons.some(polygon => pointInPolygonD(inside, polygon, precision) === PointInPolygonResult.IsInside)
}

/** Whether a piece is too thin anywhere to let a crisp patch of light through: it vanishes when shrunk by half of `width`. */
export function narrowerThan(polygon: Polygon, width: number) {
  return area(inset([polygon], width / 2)) < 1e-6
}

/** Cuts a convex polygon down to the side of the line through `on` that `normal` points away from. */
export function halfPlane(polygon: Polygon, on: Point, normal: Point): Polygon {
  const side = ({x, y}: Point) => (x - on.x) * normal.x + (y - on.y) * normal.y
  const kept: Array<Point> = []
  for (const [index, current] of polygon.entries()) {
    const next = polygon[(index + 1) % polygon.length]
    const [here, there] = [side(current), side(next)]
    if (here <= 0) {
      kept.push(current)
    }
    // Where the edge crosses the line, rather than only touching it.
    if (here < 0 === there < 0 || here === 0 || there === 0) {
      continue
    }
    const t = here / (here - there)
    kept.push(point(current.x + (next.x - current.x) * t, current.y + (next.y - current.y) * t))
  }
  return kept
}

/**
 * The panes of an opening shaped like `outline` and divided along the edges of `cells` by bars `bar` wide, a bar running round its edge too: every cell cut to the outline and shrunk by half a bar on every side.
 * Panes narrower than `smallest` anywhere are left out, as the light would hardly come through them.
 */
export function panes(outline: Polygons, cells: Polygons, bar: number, smallest: number): Polygons {
  const inside = inset(outline, bar / 2)
  return cells.flatMap(cell => inset(intersect([cell], inside), bar / 2)).filter(pane => !narrowerThan(pane, smallest))
}

/** The motifs that lie wholly within the convex `outline`, at least `rim` from its edge: those whose corners all do, as nothing of a motif bulges out between its corners where the outline curves in nowhere. */
export function motifsWithin(outline: Polygons, motifs: Polygons, rim: number): Polygons {
  const inside = inset(outline, rim)
  // Most motifs lie well inside, the whole circle round them too, which a single test of its middle against the outline shrunk by the largest of those circles tells.
  const circles = motifs.map(motif => {
    const middle = point(motif.reduce((sum, {x}) => sum + x, 0) / motif.length, motif.reduce((sum, {y}) => sum + y, 0) / motif.length)
    return {
      middle,
      radius: Math.max(...motif.map(({x, y}) => Math.hypot(x - middle.x, y - middle.y))),
    }
  })
  const deep = inset(outline, rim + Math.max(0, ...circles.map(({radius}) => radius)))
  return motifs.filter((motif, index) => contains(deep, circles[index].middle) || motif.every(corner => contains(inside, corner)))
}
