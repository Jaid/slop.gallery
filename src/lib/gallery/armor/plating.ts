import type {LatticePoint} from '../curios/lattice.ts'
import type {Vec3} from '../types.ts'

import {BufferGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3} from 'three/webgpu'

import latticeGeometry from '../curios/lattice.ts'

export const degree = Math.PI / 180

/** the attribute `ForgedSteelMaterial` reads where a point of its steel lies: how far in a hole, and how freshly polished */
export const steelMask = {
  name: 'steelMask',
  size: 2,
} as const

/** what a plate’s steel looks like, see `ForgedSteelMaterial` */
export type Finish = {
  /** how far it lies in a hole through the steel, showing only the dark inside */
  hole?: number
  /** how freshly polished it is */
  polish?: number
}

/** a point of a joint or an axis, in the frame of the left side; the right side mirrors it */
export type Joint = readonly [x: number, y: number, z: number]

/** a cross section of a plate round its axis */
export type Section = {
  /** where along the axis it lies, from its first end at 0 to its last at 1 */
  at: number
  back: number
  /** how far the crease down its front stands out */
  crease?: number
  front: number
  /** how far it lies off the axis, to the side and to the front */
  offset?: readonly [side: number, front: number]
  side: number
  /** how square it is, 2 for an ellipse */
  square?: number
  /** how far it curves back toward its sides, by the square of how far out to the side, like a plate wrapped round a limb behind it */
  wrap?: number
}

/** how far a dome reaches from its middle: to either side, to the front, to the back and up to its crown */
export type DomeReach = {
  back: number
  front: number
  height: number
  side: number
}

/** how far round from straight ahead the crease down the front of a plate reaches to either side */
const creaseSpan = 26
const sign = (value: number) => (value < 0 ? -1 : 1)
/** a superellipse’s coordinate of the direction’s coordinate, squarer the larger `square` is */
export const squared = (value: number, square: number) => sign(value) * Math.abs(value) ** (2 / square)
export const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
/** `count` angles evenly round from straight behind, in degrees */
export const columnsOf = (count: number) => Array.from({length: count}, (_, index) => -180 + index * 360 / count)
/** `count + 1` angles evenly from `from` to `to`, in degrees, both ends included */
export const arcOf = (from: number, to: number, count: number) => Array.from({length: count + 1}, (_, index) => from + (to - from) * index / count)
export const steel = (position: Vec3 | Vector3, {hole = 0, polish = 0.1}: Finish = {}): LatticePoint => ({
  position: position instanceof Vector3 ? position.toArray() : position,
  values: [hole, polish],
})
/** the outward bulge of the crease down a plate’s front at `theta` degrees round from straight ahead */
export const creaseAt = (theta: number, crease = 0) => crease * Math.max(0, 1 - Math.abs(theta) / creaseSpan) ** 1.5
/** the sawtooth of lames lapping over each other between the edges: each grows from nothing to `rise` toward the next edge, under which the next one starts again from nothing */
export const lames = (value: number, edges: ReadonlyArray<number>, rise: number) => {
  const index = edges.findLastIndex(edge => edge <= value)
  if (index === -1 || index === edges.length - 1) {
    return 0
  }
  return rise * (value - edges[index]) / (edges[index + 1] - edges[index])
}
/** the samples of `values` with every edge stepped across, a tiny step either side of it so it stands crisp */
export const withEdges = (values: ReadonlyArray<number>, edges: ReadonlyArray<number>, step: number) => [...values.filter(value => edges.every(edge => Math.abs(value - edge) > step * 2)), ...edges.flatMap(edge => [edge - step, edge + step])].toSorted((a, b) => a - b)
/** a section with every optional field filled in */
type FullSection = Required<Section>
const fill = (section: Section): FullSection => ({
  crease: 0,
  offset: [0, 0],
  square: 2,
  wrap: 0,
  ...section,
})
/** a rolled edge: how far its bead stands out, and whether the plate turns back in under it, so its thickness shows */
type Roll = number | undefined

/** The section at `at` through the sections, along a smooth curve through all of them, held at the first and last. */
export function sectionAt(sections: ReadonlyArray<Section>, at: number): FullSection {
  const full = sections.map(fill)
  if (at <= full[0].at || full.length === 1) {
    return {
      ...full[0],
      at,
    }
  }
  if (at >= full.at(-1)!.at) {
    return {
      ...full.at(-1)!,
      at,
    }
  }
  const index = full.findLastIndex(section => section.at <= at)
  const [a, b] = [full[index], full[index + 1]]
  const span = b.at - a.at
  const share = (at - a.at) / span
  // Cubic Hermite with the slopes of the neighbors either side, flat at the ends
  const [h00, h10, h01, h11] = [2 * share ** 3 - 3 * share ** 2 + 1, share ** 3 - 2 * share ** 2 + share, -2 * share ** 3 + 3 * share ** 2, share ** 3 - share ** 2]
  const slope = (i: number, value: (section: FullSection) => number) => {
    if (i <= 0 || i >= full.length - 1) {
      return 0
    }
    return (value(full[i + 1]) - value(full[i - 1])) / (full[i + 1].at - full[i - 1].at)
  }
  const curve = (value: (section: FullSection) => number) => h00 * value(a) + h10 * span * slope(index, value) + h01 * value(b) + h11 * span * slope(index + 1, value)
  return {
    at,
    back: curve(section => section.back),
    crease: curve(section => section.crease),
    front: curve(section => section.front),
    offset: [curve(section => section.offset[0]), curve(section => section.offset[1])],
    side: curve(section => section.side),
    square: curve(section => section.square),
    wrap: curve(section => section.wrap),
  }
}

/**
 * An open sheet over `rows` of as many points each, its columns not closing round, with smooth normals.
 * Seen from its outside, the rows run down it and the points of every row to the right, like the front of a `latticeGeometry`.
 */
export function sheetGeometry(rows: ReadonlyArray<ReadonlyArray<LatticePoint>>) {
  const columns = rows[0].length
  if (rows.length < 2 || columns < 2 || rows.some(row => row.length !== columns)) {
    throw new RangeError('A sheet needs at least two rows of at least two points each, all as long.')
  }
  const points = rows.flat()
  const positions = new Float32Array(points.length * 3)
  const values = new Float32Array(points.length * steelMask.size)
  for (const [index, {position, values: own = [0, 0]}] of points.entries()) {
    positions.set(position, index * 3)
    values.set(own, index * steelMask.size)
  }
  const indices: Array<number> = []
  for (let row = 0; row < rows.length - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column
      const [b, c, d] = [a + columns, a + 1, a + columns + 1]
      indices.push(a, b, c, c, b, d)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute(steelMask.name, new Float32BufferAttribute(values, steelMask.size))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** how freshly polished a rolled edge is, its bead honed bright where it catches every knock */
const rollPolish = 0.4
/** The rows of a roll along the last `length` of a plate, toward its edge at 1, the first of them where the plate leaves its course: the plate swells into the bead and turns back in under it, so its thickness shows. */
export function rollRows(roll: number, length: number) {
  const step = roll / Math.max(length, 1e-6)
  return [
    {
      u: 1 - step * 3.2,
      bulge: 0,
    },
    {
      u: 1 - step * 1.1,
      bulge: roll * 0.85,
    },
    {
      u: 1,
      bulge: roll * 0.45,
    },
    {
      u: 1,
      bulge: -roll * 0.6,
    },
  ]
}
/** the finish of a point of a plate, honed bright on its rolls */
const finishOf = (finish: Finish | undefined, bulge: number): Finish | undefined => (bulge === 0 ? finish : {
  ...finish,
  polish: Math.max(finish?.polish ?? 0, rollPolish),
})

/**
 * A plate wrapped round the axis from `from` to `to` through its sections, its front turned toward `front` as far as the axis lets it.
 * Round all the way it is a closed band, closed flat at the ends asked for; over an `arc` of degrees round from straight ahead, it is an open sheet.
 * `extent` cuts its far end short at every angle round, as a share of its length, like the pointed top of a plackart, and `shift` moves both ends along the axis there, like the dip of a lame at the front; `rolls` roll its edges at either end into a bead that far out.
 */
export function plate(from: Joint, to: Joint, sections: ReadonlyArray<Section>, {arc, caps = [false, false], columns, extent, finish, front = [0, 0, 1], rolls = [undefined, undefined], samples, shift}: {
  arc?: readonly [from: number, to: number]
  caps?: readonly [start: boolean, end: boolean]
  columns: number
  extent?: (theta: number) => number
  finish?: Finish
  front?: Joint
  rolls?: readonly [start: Roll, end: Roll]
  /** where along the axis its rows lie, its sections’ by default */
  samples?: ReadonlyArray<number>
  shift?: (theta: number) => number
}) {
  const start = new Vector3(...from)
  const axis = new Vector3(...to)
  axis.sub(start)
  const length = axis.length()
  const down = axis.clone().normalize()
  const ahead = new Vector3(...front)
  ahead.addScaledVector(down, -ahead.dot(down)).normalize()
  const side = new Vector3
  side.crossVectors(ahead, down)
  const thetas = arc ? arcOf(arc[0], arc[1], columns) : columnsOf(columns)
  const [startRoll, endRoll] = rolls
  // Its rows along the axis from its start to its end, squeezed between its rolls, and its rolls’ rows, each roll as wide at every angle round
  const base = samples ?? sections.map(section => section.at)
  const rowsAt = (theta: number) => {
    const span = length * (extent?.(theta) ?? 1)
    const [head, tail] = [startRoll ? startRoll * 3.2 / span : 0, endRoll ? endRoll * 3.2 / span : 0]
    const squeezed = base.map(u => ({
      u: head + u * (1 - head - tail),
      bulge: 0,
    }))
    const rolledEnd = endRoll ? rollRows(endRoll, span).slice(1) : []
    const rolledStart = startRoll ? rollRows(startRoll, span).slice(1).map(row => ({
      ...row,
      u: 1 - row.u,
    })).toReversed() : []
    return [...rolledStart, ...squeezed, ...rolledEnd]
  }
  const pointAt = (u: number, theta: number, bulge: number) => {
    const at = u * (extent?.(theta) ?? 1) + (shift?.(theta) ?? 0) / length
    const {back, crease, front: frontReach, offset: [across, forward], side: sideReach, square, wrap} = sectionAt(sections, at)
    const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
    const depth = cos > 0 ? frontReach : back
    const x = sideReach * squared(sin, square)
    const z = depth * squared(cos, square) + creaseAt(theta, crease) - wrap * x ** 2
    const reach = Math.hypot(x, z) || 1
    const point = start.clone().addScaledVector(down, at * length).addScaledVector(side, across + x * (1 + bulge / reach)).addScaledVector(ahead, forward + z * (1 + bulge / reach))
    return point
  }
  const columnRows = thetas.map(theta => rowsAt(theta).map(({u, bulge}) => steel(pointAt(u, theta, bulge), finishOf(finish, bulge))))
  const points = columnRows[0].map((_, row) => columnRows.map(column => column[row]))
  if (arc) {
    return sheetGeometry(points)
  }
  const rows = rowsAt(0)
  const centerOf = (u: number) => {
    const {offset: [across, forward]} = sectionAt(sections, u)
    return start.clone().addScaledVector(down, u * length).addScaledVector(side, across).addScaledVector(ahead, forward)
  }
  return latticeGeometry(points, {
    start: caps[0] ? steel(centerOf(rows[0].u), finish) : undefined,
    end: caps[1] ? steel(centerOf(rows.at(-1)!.u), finish) : undefined,
    extra: steelMask,
  })
}

/**
 * A dome of plate over `center`, its crown toward `up`, its front turned toward `front` as far as `up` lets it, from its crown down to its rim, open there.
 * Its rows lie at the shares `rows` of the way from its crown to its rim, which lies `rim` degrees down from the crown at every angle round from straight ahead, `swell` scaling it out from the middle at every share; `roll` rolls its rim into a bead that far out.
 */
export function dome(center: Joint, up: Joint, front: Joint, {back, front: frontReach, height, side: sideReach}: DomeReach, rows: ReadonlyArray<number>, {columns, finish, rim, roll, swell = () => 1}: {
  columns: number
  finish?: Finish
  /** how far down from the crown its rim lies at `theta` degrees round, as a polar angle in degrees */
  rim: (theta: number) => number
  roll?: number
  swell?: (share: number, theta: number) => number
}) {
  const middle = new Vector3(...center)
  const crown = new Vector3(...up)
  crown.normalize()
  const ahead = new Vector3(...front)
  ahead.addScaledVector(crown, -ahead.dot(crown)).normalize()
  const side = new Vector3
  side.crossVectors(crown, ahead)
  const thetas = columnsOf(columns)
  const at = (share: number, theta: number, bulge = 0) => {
    const phi = share * rim(theta)
    const [sinPhi, cosPhi] = [Math.sin(phi * degree), Math.cos(phi * degree)]
    const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
    const scale = swell(share, theta)
    const local = new Vector3(sideReach * sinPhi * sin * scale, height * cosPhi * scale, (cos > 0 ? frontReach : back) * sinPhi * cos * scale)
    if (bulge) {
      local.multiplyScalar(1 + bulge / local.length())
    }
    return middle.clone().addScaledVector(side, local.x).addScaledVector(crown, local.y).addScaledVector(ahead, local.z)
  }
  const shares = rows.map(share => ({
    share,
    bulge: 0,
  }))
  let all = shares
  if (roll) {
    // The rim’s roll over its last few millimeters, by the shortest reach
    const span = Math.min(sideReach, frontReach, back) * 1.6
    all = [...shares.filter(row => row.share < 1 - roll * 3.2 / span - 1e-4), ...rollRows(roll, span).map(({u, bulge}) => ({
      share: u,
      bulge,
    }))]
  }
  return latticeGeometry(all.map(({share, bulge}) => thetas.map(theta => steel(at(share, theta, bulge), finishOf(finish, bulge)))), {
    start: steel(at(0, 0), finish),
    extra: steelMask,
  })
}

/** Rivet heads, low domes on a surface at the points, facing out along its normals. */
export function rivetHeads(points: ReadonlyArray<{
  normal: Vector3
  position: Vec3
}>, radius: number, polish = 0.5) {
  const up = new Vector3(0, 1, 0)
  const turn = new Quaternion
  return points.map(({normal, position}) => {
    const head = new SphereGeometry(radius, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)
    head.deleteAttribute('uv')
    head.scale(1, 0.5, 1).applyQuaternion(turn.setFromUnitVectors(up, normal)).translate(...position)
    const mask = Float32Array.from({length: head.getAttribute('position').count * 2}, (_, index) => (index % 2 ? polish : 0))
    head.setAttribute(steelMask.name, new Float32BufferAttribute(mask, steelMask.size))
    return head
  })
}
