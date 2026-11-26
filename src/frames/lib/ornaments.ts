import type {OrnamentOptions} from './frameGeometry.ts'

import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape, Vector2} from 'three/webgpu'

import {cavityAttribute, ornament} from './frameGeometry.ts'

/** a point of a turned outline: how far out from its axis and how far along it */
export type TurnedPoint = readonly [radius: number, height: number]
/** a point in the frame’s plane, in meters */
export type PlanePoint = readonly [x: number, y: number]
/** a point of an ornament in meters, z toward the viewer */
export type OrnamentPoint = readonly [x: number, y: number, z: number]
/** how far in front of the frame’s middle the surface an ornament rests on lies under a point of the frame’s plane */
export type RestingSurface = (x: number, y: number) => number
/** how a sheet ornament takes the frame’s shading, see {@link sheet} */
export type SheetOptions = Omit<OrnamentOptions, 'cavity'>

/**
 * A curved sheet like a leaf, a petal or a shell: the points `at` gives for every column from 0 to `columns` and every row from 0 to `rows`, joined into a grid that is smooth within, its front turned toward the viewer. Its `uv` are the column and the row as shares from 0 to 1, unless `ownUv` is false, and `cavity`, if given, tells how hollow each point counts as.
 *
 * With `wrap`, its last column lies on its first, closing it round like a rosette, and with `pole` its first row is a single point, like a rosette’s middle: both keep smooth there. With `back`, it faces away from the viewer instead, like the underside of something standing off the wall.
 */
export function sheet(columns: number, rows: number, at: (column: number, row: number) => OrnamentPoint, {back = false, cavity, ownUv = true, pole = false, wrap = false, ...options}: SheetOptions & {
  back?: boolean
  cavity?: (column: number, row: number) => number
  pole?: boolean
  wrap?: boolean
} = {}) {
  const position: Array<number> = []
  const uv: Array<number> = []
  const hollow: Array<number> = []
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      position.push(...at(column, row))
      uv.push(column / columns, row / rows)
      if (cavity) {
        hollow.push(cavity(column, row))
      }
    }
  }
  const vertex = (column: number, row: number) => row * (columns + 1) + column
  const index: Array<number> = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      index.push(vertex(column, row), vertex(column + 1, row), vertex(column + 1, row + 1), vertex(column, row), vertex(column + 1, row + 1), vertex(column, row + 1))
    }
  }
  // Whichever way round the points run, the sheet as a whole faces the viewer, or away from them.
  let facing = 0
  for (let triangle = 0; triangle < index.length; triangle += 3) {
    const [a, b, c] = [index[triangle] * 3, index[triangle + 1] * 3, index[triangle + 2] * 3]
    facing += (position[b] - position[a]) * (position[c + 1] - position[a + 1]) - (position[b + 1] - position[a + 1]) * (position[c] - position[a])
  }
  if (back ? facing > 0 : facing < 0) {
    for (let triangle = 0; triangle < index.length; triangle += 3) {
      [index[triangle + 1], index[triangle + 2]] = [index[triangle + 2], index[triangle + 1]]
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  if (cavity) {
    geometry.setAttribute(cavityAttribute, new Float32BufferAttribute(hollow, 1))
  }
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  // Points that lie on each other share one normal: the seam of a closed sheet and the pole.
  const normal = geometry.getAttribute('normal')
  const share = (vertices: ReadonlyArray<number>) => {
    const sum = [0, 0, 0]
    for (const point of vertices) {
      sum[0] += normal.getX(point)
      sum[1] += normal.getY(point)
      sum[2] += normal.getZ(point)
    }
    const length = Math.hypot(...sum) || 1
    for (const point of vertices) {
      normal.setXYZ(point, sum[0] / length, sum[1] / length, sum[2] / length)
    }
  }
  if (wrap) {
    for (let row = 0; row <= rows; row++) {
      share([vertex(0, row), vertex(columns, row)])
    }
  }
  if (pole) {
    share(Array.from({length: columns + 1}, (_, column) => vertex(column, 0)))
  }
  return ornament(geometry, {
    ...options,
    ownUv,
  })
}

/**
 * A rod laid along a path in the frame’s plane, like a scroll, a stem or a rib: rounded over the top, `flatten` times as high as it is wide, its sides sinking down to `foot`, by default 2 mm into the surface it rests on. `radius` gives its half width for every share t along the path, so ends tapering to nothing close it; `sides` is how many pieces its round has. Its `uv` are the share along the path and the share round from one side to the other.
 */
export function tube(path: ReadonlyArray<PlanePoint>, radius: (t: number) => number, rest: RestingSurface, {flatten = 1, sides = 6, foot = (x, y) => rest(x, y) - 0.002, ...options}: SheetOptions & {
  flatten?: number
  /** how far in front of the frame’s middle its sides end under a point of the frame’s plane */
  foot?: RestingSurface
  sides?: number
} = {}) {
  const lengths = [0]
  for (let index = 1; index < path.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(path[index][0] - path[index - 1][0], path[index][1] - path[index - 1][1]))
  }
  const total = lengths.at(-1)!
  const normals = path.map((_, index) => {
    const [ax, ay] = path[Math.max(0, index - 1)]
    const [bx, by] = path[Math.min(path.length - 1, index + 1)]
    const length = Math.hypot(bx - ax, by - ay)
    return [-(by - ay) / length, (bx - ax) / length] as const
  })
  // Two rows more than the round has, one at either side, sunk into the surface below.
  return sheet(path.length - 1, sides + 2, (column, row) => {
    const [x, y] = path[column]
    const [nx, ny] = normals[column]
    const width = radius(lengths[column] / total)
    const side = Math.min(sides, Math.max(0, row - 1))
    const angle = (side / sides - 0.5) * Math.PI
    const across = Math.sin(angle) * width
    const [px, py] = [x + nx * across, y + ny * across]
    const sunk = row === 0 || row === sides + 2
    return [px, py, sunk ? foot(px, py) : rest(px, py) + Math.cos(angle) * width * flatten]
  }, {
    ...options,
    // Its flanks count as hollow, its crown as a ridge.
    cavity: (_, row) => (row === 0 || row === sides + 2 ? 1 : Math.abs(row - 1 - sides / 2) / (sides / 2) * 1.2 - 0.6),
  })
}

/** Points along a smooth curve through the control points, a centripetal Catmull–Rom spline, `steps` pieces between each two of them. */
export function smoothPath(points: ReadonlyArray<PlanePoint>, steps: number): Array<PlanePoint> {
  const result: Array<PlanePoint> = [points[0]]
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[Math.min(points.length - 1, index + 2)]
    const knot = (a: PlanePoint, b: PlanePoint) => Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5)
    const t1 = knot(p0, p1)
    const t2 = t1 + knot(p1, p2)
    const t3 = t2 + knot(p2, p3)
    for (let step = 1; step <= steps; step++) {
      const t = t1 + (t2 - t1) * step / steps
      const mix = (a: PlanePoint, b: PlanePoint, ta: number, tb: number): PlanePoint => [a[0] + (b[0] - a[0]) * (t - ta) / (tb - ta), a[1] + (b[1] - a[1]) * (t - ta) / (tb - ta)]
      const a1 = mix(p0, p1, 0, t1)
      const a2 = mix(p1, p2, t1, t2)
      const a3 = mix(p2, p3, t2, t3)
      const b1 = mix(a1, a2, 0, t2)
      const b2 = mix(a2, a3, t1, t3)
      result.push(mix(b1, b2, t1, t2))
    }
  }
  return result
}

/** Points along a spiral round `center`, from the angle `from` to `to` in radians, its radius easing exponentially from `start` to `end`, in `steps` pieces. */
export function spiralPath(center: PlanePoint, from: number, to: number, start: number, end: number, steps: number): Array<PlanePoint> {
  return Array.from({length: steps + 1}, (_, step) => {
    const t = step / steps
    const angle = from + (to - from) * t
    const radius = start * (end / start) ** t
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius] as const
  })
}

/** The path with its end rolled up into a volute: a spiral going on smoothly from its last point, `turns` times round, counterclockwise for positive turns and clockwise for negative ones, its radius easing from `radius` to `shrink` times that in `steps` pieces. */
export function curled(path: ReadonlyArray<PlanePoint>, radius: number, turns: number, steps: number, shrink = 0.3): Array<PlanePoint> {
  const [ex, ey] = path.at(-1)!
  const [bx, by] = path.at(-2)!
  const length = Math.hypot(ex - bx, ey - by)
  const side = Math.sign(turns)
  const center = [ex - (ey - by) / length * side * radius, ey + (ex - bx) / length * side * radius] as const
  const from = Math.atan2(ey - center[1], ex - center[0])
  return [...path, ...spiralPath(center, from, from + turns * Math.PI * 2, radius, radius * shrink, steps).slice(1)]
}

/** How many triangles a part holds, which must come from {@link ornament}, as frames add them up against their budget. */
export function triangles(part: BufferGeometry) {
  return part.getAttribute('position').count / 3
}

/** A turned ornament like a rosette, a boss or a stud: the outline revolved round the z axis, which faces the viewer, in `segments` sides. */
export function turned(outline: ReadonlyArray<TurnedPoint>, segments: number, options?: OrnamentOptions) {
  const lathe = new LatheGeometry(outline.map(([radius, height]) => new Vector2(radius, height)), segments)
  // A lathe turns about y; tipped forward, its axis points at the viewer.
  lathe.rotateX(Math.PI / 2)
  return ornament(lathe, options)
}

/** A round-topped stud of `radius`, `height` over its foot, in `segments` sides and `rings` steps from its rim to its crown. */
export function dome(radius: number, height: number, {segments = 8, rings = 3, ...options}: OrnamentOptions & {
  rings?: number
  segments?: number
} = {}) {
  // From the rim round a quarter ellipse to the crown, which lies exactly on the axis.
  const outline = Array.from({length: rings + 1}, (_, ring): TurnedPoint => {
    const angle = ring / rings * Math.PI / 2
    return ring === rings ? [0, height] : [Math.cos(angle) * radius, Math.sin(angle) * height]
  })
  return turned(outline, segments, options)
}

/** A box of `width` × `height` × `depth` meters, its back on z = 0. */
export function block(width: number, height: number, depth: number, options?: OrnamentOptions) {
  const box = new BoxGeometry(width, height, depth)
  box.translate(0, 0, depth / 2)
  return ornament(box, options)
}

/** A flat shape of points in meters, counterclockwise, raised `depth` toward the viewer from z = 0, its front edge eased by a bevel of `bevel` meters. */
export function relief(points: ReadonlyArray<readonly [number, number]>, depth: number, {bevel = 0, ...options}: OrnamentOptions & {bevel?: number} = {}) {
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)))
  const extrusion = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  })
  // The bevel grows behind the back as well as in front; the back is against the frame, so it moves forward by it.
  extrusion.translate(0, 0, bevel)
  return ornament(extrusion, options)
}
