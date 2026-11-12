import type {BufferGeometry} from 'three/webgpu'

import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {ExtrudeGeometry, Float32BufferAttribute, BufferGeometry as Geometry, LatheGeometry, Shape, SphereGeometry, SplineCurve, Vector2, Vector3} from 'three/webgpu'

import {orbRadius} from '#src/orbs/index.ts'

import {mergeParts} from '../geometry.ts'

/** a point in a plane: of a turned outline, its radius and height, or of a flat one, across and up */
type Point = readonly [x: number, y: number]
/** one smooth stretch of the stand’s turned outline, which meets the next in a crease */
type Span = {
  /** the outline’s point at `t` from 0 to 1 */
  at: (t: number) => Point
  /** how deeply the creases between lobes gadrooning it round the stand cut in at `t`, as a share of their full depth, if it is gadrooned like the cup */
  relief?: (t: number) => number
  /** how many rings of faces it is turned in */
  steps: number
}

/** the beaded band the cup stands on, raised over the cap on the feet: its underside, the beads along its bottom and top edges and the plain frieze between them */
const band = {
  bottom: 0.034,
  beadRadius: 0.005,
  beadCenter: 0.114,
  frieze: 0.112,
  top: 0.064,
}
/** the rolled lip round the cup’s mouth, which the orb rests on */
const lip = {
  radius: 0.108,
  tube: 0.0075,
  y: 0.124,
  /** where the roll starts, as an angle round its tube from straight outward, up being positive: inward on its underside, within the cup, so that it closes over the tops of the cup’s creases, which run on into it */
  from: -Math.PI * 3 / 4,
  /** where it comes out of the cup’s lobes, from which on it is seen and turned in finer steps */
  emerges: -Math.PI / 3,
}
/** the gadrooned cup on the band, from its foot up into the lip’s roll, bulging out between */
const cup = {
  foot: [0.094, 0.068],
  /** within the lip’s roll, which swallows the cup’s top */
  top: [0.112, 0.119],
  bulge: 0.016,
  lobes: 16,
  /** how deep the creases between the lobes cut in, as a share of the cup’s radius where they are deepest */
  crease: 0.075,
  /** how steeply a lobe falls into the creases on either side, from its middle, in radians */
  flank: Math.PI / 3,
} as const
/** the scrolled feet under the band, evenly round it, one of them pointing to the front, along +z */
const feet = {
  count: 3,
  /** how thick a foot’s bracket is across, apart from its chamfered edges */
  depth: 0.014,
  bevel: 0.003,
}
/** faces round the stand: four to each of the cup’s lobes, so that every crease and the middle of every lobe lies on an edge */
const segments = cup.lobes * 4
/** where the creases between the lobes lie round the stand, as a share of a turn, so that a lobe swells out to the front, toward the front foot */
const creasePhase = 0.5 / cup.lobes
/** steps for estimating the surface’s slopes, in its parameters */
const slopeStep = 1e-5
/** columns to each lobe of the cup */
const lobeColumns = segments / cup.lobes

/** how high the middle of an orb resting on the lip stands over the holder’s foot, where its ball touches the lip’s roll all round */
export const orbSeat = lip.y + Math.sqrt((orbRadius + lip.tube) ** 2 - lip.radius ** 2)

const semicircle = ([radius, y]: Point, size: number, from: number, to: number, steps = 8): Array<Vector2> => Array.from({length: steps + 1}, (_, index) => {
  const angle = from + (to - from) * index / steps
  return new Vector2(radius + Math.cos(angle) * size, y + Math.sin(angle) * size)
})
const arc = ([radius, y]: Point, size: number, from: number, to: number) => (t: number): Point => {
  const angle = from + (to - from) * t
  return [radius + Math.cos(angle) * size, y + Math.sin(angle) * size]
}
const line = (from: Point, to: Point) => (t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
/** the cup’s outline before it is gadrooned, `t` from its foot up to the lip: swelling out below its middle and drawing in again toward the lip */
const cupRadius = (t: number) => cup.foot[0] + (cup.top[0] - cup.foot[0]) * t + cup.bulge * Math.sin(Math.PI * t ** 0.75)
const cupY = (t: number) => cup.foot[1] + (cup.top[1] - cup.foot[1]) * t
/** How far a lobe stands out at `x` across it from one crease to the next: 0 in the creases and 1 in its middle, on a circular arc, so its normal turns evenly across it and shades smooth even over few faces. */
const lobe = (x: number) => (Math.sqrt(1 - ((2 * x - 1) * Math.sin(cup.flank)) ** 2) - Math.cos(cup.flank)) / (1 - Math.cos(cup.flank))
/** how deeply the creases cut in `t` up the cup: fading in from its foot, then fully on up into the lip’s roll */
const creaseDepth = (t: number) => (t < 0.5 ? 1 - (2 * t - 1) ** 4 : 1)
/** where the orb’s ball meets nothing but the lip: the hollow inside the cup, from under the lip down to the middle */
const bowl = new SplineCurve([
  [lip.radius - lip.tube, lip.y],
  [0.098, 0.112],
  [0.085, 0.095],
  [0.06, 0.08],
  [0.03, 0.074],
  [0, 0.073],
].map(([radius, y]) => new Vector2(radius, y)))
const bead = (center: number, from: number, to: number) => arc([band.beadCenter, center], band.beadRadius, from, to)
/** The stand’s turned outline, from the middle of its underside out and up round the band’s beads, up the cup, over the lip and down the bowl to its middle, in stretches that meet in creases. */
const contour: ReadonlyArray<Span> = [
  {
    at: line([0, band.bottom], [band.beadCenter, band.bottom]),
    steps: 1,
  },
  {
    at: bead(band.bottom + band.beadRadius, -Math.PI / 2, Math.PI * 2 / 3),
    steps: 3,
  },
  {
    at: line(bead(band.bottom + band.beadRadius, 0, Math.PI * 2 / 3)(1), bead(band.top - band.beadRadius, -Math.PI * 2 / 3, 0)(0)),
    steps: 1,
  },
  {
    at: bead(band.top - band.beadRadius, -Math.PI * 2 / 3, Math.PI / 2),
    steps: 3,
  },
  {
    at: line([band.beadCenter, band.top], [cup.foot[0], cup.foot[1]]),
    steps: 1,
  },
  {
    // Evenly along how far the cup’s bulge has come rather than along its height, so its rings crowd toward its foot, where it flares out flat, and its slopes stay finite.
    at: s => [cupRadius(s ** (4 / 3)), cupY(s ** (4 / 3))],
    relief: s => creaseDepth(s ** (4 / 3)),
    steps: 7,
  },
  {
    at: arc([lip.radius, lip.y], lip.tube, lip.from, lip.emerges),
    steps: 1,
  },
  {
    at: arc([lip.radius, lip.y], lip.tube, lip.emerges, Math.PI),
    steps: 4,
  },
  {
    at: t => {
      const {x, y} = bowl.getPoint(t)
      return [x, y]
    },
    steps: 3,
  },
]
/** The stand’s turned surface at `u` of a turn round it and `t` along a stretch of its outline, gadrooned if the stretch is. */
function surfacePoint(span: Span, u: number, t: number, target: Vector3) {
  const [radius, y] = span.at(t)
  const angle = u * Math.PI * 2
  const across = ((u - creasePhase) * cup.lobes % 1 + 1) % 1
  const gadrooned = span.relief ? radius * (1 - cup.crease * span.relief(t) * (1 - lobe(across))) : radius
  // Turning the same way as a lathe, so the surface faces out.
  return target.set(Math.sin(angle) * gadrooned, y, Math.cos(angle) * gadrooned)
}
const point = new Vector3
const ahead = new Vector3
const behind = new Vector3
const alongU = new Vector3
const alongT = new Vector3
/** The surface’s normal at `u` and `t`, from its slopes measured only on the side of `u` and `t` the face it belongs to lies on, so creases stay sharp. */
function surfaceNormal(span: Span, u: number, t: number, uSide: -1 | 0 | 1, tSide: -1 | 0 | 1, target: Vector3) {
  // The middle of the turn has no slope round it; it faces the way its surroundings face.
  const along = span.at(t)[0] < 1e-9 ? t + Math.sign(tSide || 1) * slopeStep * 10 : t
  const slope = (side: -1 | 0 | 1, sample: (offset: number, out: Vector3) => Vector3, result: Vector3) => {
    sample(side <= 0 ? -slopeStep : 0, behind)
    sample(side >= 0 ? slopeStep : 0, ahead)
    return result.subVectors(ahead, behind)
  }
  slope(uSide, (offset, out) => surfacePoint(span, u + offset, along, out), alongU)
  slope(tSide, (offset, out) => surfacePoint(span, u, along + offset, out), alongT)
  return target.crossVectors(alongU, alongT).normalize()
}
/** which way from a column or ring the faces it belongs to lie: -1 for the last, 1 for the first and 0 for one in between */
const side = (index: number, last: number) => (index === last ? -1 : Number(index === 0)) as -1 | 0 | 1
/** One stretch of the outline turned all round: one ring of faces per step, closed into a fan where it reaches the middle, and on gadrooned stretches split into one patch per lobe, so their creases stay sharp. */
function turnSpan(span: Span): BufferGeometry {
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  // Columns round the stand, as shares of a turn; every patch is a run of them meeting the next in a crease.
  const run = (from: number, count: number) => Array.from({length: count + 1}, (_, column) => creasePhase + (from + column) / segments)
  const patches = span.relief ? Array.from({length: cup.lobes}, (_, lobeIndex) => run(lobeIndex * lobeColumns, lobeColumns)) : [run(0, segments)]
  const centered = (row: number) => span.at(row / span.steps)[0] < 1e-9
  for (const columns of patches) {
    const base = positions.length / 3
    const rows = span.steps + 1
    for (const [columnIndex, u] of columns.entries()) {
      const uSide = span.relief ? side(columnIndex, columns.length - 1) : 0
      for (let row = 0; row < rows; row++) {
        const t = row / span.steps
        const tSide = side(row, span.steps)
        surfacePoint(span, u, t, point)
        const normal = surfaceNormal(span, u, t, uSide, tSide, new Vector3)
        positions.push(point.x, point.y, point.z)
        normals.push(normal.x, normal.y, normal.z)
        uvs.push(u, t)
      }
    }
    for (let column = 0; column < columns.length - 1; column++) {
      for (let row = 0; row < span.steps; row++) {
        const a = base + column * rows + row
        const b = a + rows
        const c = b + 1
        const d = a + 1
        // A lobe’s quads are split mirrored about its middle, so its highlights stay symmetric.
        if (span.relief && column >= (columns.length - 1) / 2) {
          indices.push(a, b, c, a, c, d)
          continue
        }
        // A ring at the middle shrinks to a point, which leaves one triangle of each quad.
        if (!centered(row)) {
          indices.push(a, b, d)
        }
        if (!centered(row + 1)) {
          indices.push(b, c, d)
        }
      }
    }
  }
  const geometry = new Geometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}
/** An acanthus leaf’s outline, `width` across its foot and `height` up to its tip, its edges lobed three times on either side. */
function leafShape(width: number, height: number) {
  const half = width / 2
  // Up the right edge from the foot to the tip as curves bulging out between their ends, three lobes, each narrower and higher than the one below.
  const right: Array<{
    control: readonly [number, number]
    end: readonly [number, number]
  }> = []
  let start: Point = [half * 0.55, 0]
  for (const [reach, rise] of [[1, 0.3], [0.78, 0.58], [0.48, 0.82]] as const) {
    const end = [half * reach * 0.55, height * rise] as const
    right.push({
      control: [half * reach * 1.15, (start[1] + end[1]) / 2],
      end,
    })
    start = end
  }
  right.push({
    control: [half * 0.2, height * 0.95],
    end: [0, height],
  })
  const shape = new Shape
  shape.moveTo(-half * 0.55, 0)
  shape.lineTo(half * 0.55, 0)
  for (const {control, end} of right) {
    shape.quadraticCurveTo(...control, ...end)
  }
  // Down the left edge, the right one mirrored: each curve back to where its mirror image started.
  for (const [index, {control}] of right.entries().toArray().toReversed()) {
    const [x, y] = index ? right[index - 1].end : [half * 0.55, 0]
    shape.quadraticCurveTo(-control[0], control[1], -x, y)
  }
  return shape
}
/** An extrusion shaded smooth along its curved sides but sharp at its edges, where they meet its faces or chamfers. Smoothed in centimeters, as the normal utility welds positions closer than 0.01 units. */
function creased(geometry: ExtrudeGeometry) {
  const smooth = toCreasedNormals(geometry.scale(100, 100, 100), Math.PI / 6).scale(0.01, 0.01, 0.01)
  geometry.dispose()
  return smooth
}
/** One scrolled foot, standing out along x: a chamfered bracket bending out from under the band to a round toe, and an acanthus leaf rising over the band. */
function foot(): Array<BufferGeometry> {
  const outline = new Shape
  outline.moveTo(0.09, 0.042)
  outline.lineTo(0.117, 0.042)
  outline.bezierCurveTo(0.13, 0.04, 0.138, 0.03, 0.138, 0.02)
  outline.bezierCurveTo(0.138, 0.012, 0.142, 0.006, 0.15, 0.003)
  outline.lineTo(0.15, 0)
  outline.lineTo(0.12, 0)
  outline.bezierCurveTo(0.112, 0.004, 0.104, 0.016, 0.098, 0.026)
  outline.bezierCurveTo(0.094, 0.032, 0.09, 0.036, 0.09, 0.042)
  const bracket = creased(new ExtrudeGeometry(outline, {
    depth: feet.depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: feet.bevel,
    bevelThickness: feet.bevel,
    bevelOffset: -feet.bevel,
    curveSegments: 4,
  }))
  const toe = new SphereGeometry(0.011, 8, 5)
  // Sharp-edged rather than chamfered, which spends its faces on the lobes of its outline instead.
  const leaf = creased(new ExtrudeGeometry(leafShape(0.028, 0.03), {
    depth: 0.009,
    bevelEnabled: false,
    curveSegments: 4,
  }))
  return [
    bracket.translate(0, 0, -feet.depth / 2),
    toe.scale(1.2, 0.8, 1.1).translate(0.143, 0.0088, 0),
    // Its back sunk just into the frieze, its face standing just out of the beads.
    leaf.rotateY(Math.PI / 2).translate(band.frieze - 0.0005, band.bottom - 0.002, 0),
  ]
}

/**
 * A stand for an orb on a pedestal’s cap, cast in dark metal like a fortune teller’s crystal ball stand, the y axis up through its middle from the cap.
 *
 * A gadrooned cup with a rolled lip, which the orb rests in, stands on a band beaded along both edges, raised on three scrolled feet with acanthus leaves, one of them to the front.
 * Built lean: the whole turned body is one outline of smooth stretches, each turned in few faces but shaded from the exact surface, and the feet are chamfered rather than rounded, which keeps it under 4096 triangles.
 */
export default class OrbHolderGeometry {
  /** the stand turned smooth, without its lobes, feet and ornament, where the orb and everything thrown at it touch it */
  readonly collision: LatheGeometry
  readonly metal: BufferGeometry

  constructor() {
    const parts: Array<BufferGeometry> = contour.map(turnSpan)
    for (let index = 0; index < feet.count; index++) {
      // A foot stands out along x until it is turned toward the front, then on round by a third each.
      parts.push(...foot().map(part => part.rotateY(-Math.PI / 2 + index * Math.PI * 2 / feet.count)))
    }
    this.metal = mergeParts(parts)
    const collisionOutline = [
      new Vector2(0, 0),
      new Vector2(0.125, 0),
      new Vector2(0.12, band.top),
      ...Array.from({length: 9}, (_, index) => new Vector2(cupRadius(index / 8), cupY(index / 8))),
      ...semicircle([lip.radius, lip.y], lip.tube, -Math.PI / 4, Math.PI, 12),
      ...bowl.points.slice(1).map(({x, y}) => new Vector2(x, y)),
    ]
    this.collision = new LatheGeometry(collisionOutline, 48)
  }

  dispose() {
    this.metal.dispose()
    this.collision.dispose()
  }
}
