import type {Spread} from '../base/OpeningStyle.ts'
import type {Polygon, Polygons} from './polygons.ts'

import {arc, circle, ellipse, point, rectangle, round} from './polygons.ts'

/** the shapes an opening may take, each filling a box reaching `reach` from its middle, all of them convex */
export const outlineKinds = ['circle', 'square', 'diamond', 'octagon', 'hexagon', 'rounded', 'stadium'] as const
export type OutlineKind = typeof outlineKinds[number]

/**
 * An opening of `kind`, centered on the origin, reaching `reach` along x and y: the regular shape for an even reach, otherwise drawn out along the longer axis, a circle into an ellipse, a diamond into a rhombus, an octagon, a hexagon or a stadium by lengthening their sides along it.
 * A hexagon keeps its corners on the longer axis, so a regular one falls short of the reach across it.
 */
export function outline(kind: OutlineKind, reach: Spread): Polygons {
  const short = Math.min(reach.x, reach.y)
  switch (kind) {
    case 'circle': {
      return [ellipse(point(0, 0), reach.x, reach.y)]
    }
    case 'square': {
      return [rectangle(point(0, 0), reach.x * 2, reach.y * 2)]
    }
    case 'diamond': {
      return [[point(reach.x, 0), point(0, reach.y), point(-reach.x, 0), point(0, -reach.y)]]
    }
    case 'octagon': {
      // Its flat sides on the box’s, its corners cut off as a regular octagon’s are in a square.
      const cut = short * (1 - Math.tan(Math.PI / 8))
      return [lengthwise(reach, (long, across) => [point(long, -across + cut), point(long, across - cut), point(long - cut, across), point(-long + cut, across), point(-long, across - cut), point(-long, -across + cut), point(-long + cut, -across), point(long - cut, -across)])]
    }
    case 'hexagon': {
      return [lengthwise(reach, (long, across) => {
        const flat = Math.min(across, long * Math.sqrt(3) / 2)
        const corner = long - flat / Math.sqrt(3)
        return [point(long, 0), point(corner, flat), point(-corner, flat), point(-long, 0), point(-corner, -flat), point(corner, -flat)]
      })]
    }
    case 'rounded': {
      return round([rectangle(point(0, 0), reach.x * 2, reach.y * 2)], short * 0.3)
    }
    case 'stadium': {
      // Two half circles joined by straight sides, or one whole circle for an even reach.
      return [lengthwise(reach, (long, across) => {
        const end = long - across
        if (end < 1e-9) {
          return circle(point(0, 0), across)
        }
        return [...arc(point(end, 0), across, -Math.PI / 2, Math.PI / 2), ...arc(point(-end, 0), across, Math.PI / 2, Math.PI * 3 / 2)]
      })]
    }
  }
}

/** The corners `draw` gives for a shape longer along x, turned a quarter onto y if `reach` is longer along y. */
function lengthwise({x, y}: Spread, draw: (long: number, short: number) => Polygon): Polygon {
  if (x >= y) {
    return draw(x, y)
  }
  // A quarter turn counterclockwise keeps the corners running counterclockwise.
  return draw(y, x).map(corner => point(-corner.y, corner.x))
}
