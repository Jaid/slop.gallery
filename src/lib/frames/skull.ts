import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {ornament} from './frameGeometry.ts'

/** values by how far down the skull from its crown, 0, to its chin, 1, interpolated in between */
type Table = ReadonlyArray<readonly [t: number, value: number]>

/**
 * Where the features of a human skull lie seen from the front, in units of its height from crown to chin: x to the right and y up from its middle, z toward the viewer from its foot, the plane it rests on.
 */
export const anatomy = {
  /** the sockets: their middles, half their width and height, how much their outer corners droop and how deep they sink */
  orbit: {
    x: 0.135,
    y: 0.07,
    halfWidth: 0.085,
    halfHeight: 0.072,
    droop: 0.25,
    depth: 0.22,
  },
  /** the pear of the nasal hole: its middle, half its height, half its width at its bottom and at its top and how deep it sinks */
  nose: {
    y: -0.065,
    halfHeight: 0.065,
    bottom: 0.055,
    top: 0.018,
    depth: 0.17,
  },
  /** the crowns of the upper and the lower teeth, from their gums to their edges, the dark gap of the bite between them, how far out to either side they reach and how wide a front tooth is */
  teeth: {
    upper: [-0.165, -0.21],
    lower: [-0.23, -0.275],
    halfWidth: 0.15,
    width: 0.032,
  },
  /** how deep below its foot the skull’s edge sinks, so it stays buried in what it rests on as the skull turns */
  rim: -0.16,
} as const
const crown = {
  /** half the width of the cranium seen from the front, down to the bite */
  width: [[0, 0.03], [0.025, 0.14], [0.06, 0.21], [0.12, 0.27], [0.2, 0.305], [0.28, 0.315], [0.375, 0.312], [0.43, 0.3], [0.52, 0.318], [0.6, 0.28], [0.665, 0.2], [0.72, 0.165]],
  /** how far forward its middle comes: the forehead, the brow, the dip at the root of the nose, the nasal bones and the jutting upper teeth */
  depth: [[0, 0], [0.025, 0.1], [0.06, 0.2], [0.12, 0.29], [0.2, 0.36], [0.28, 0.39], [0.335, 0.41], [0.4, 0.38], [0.47, 0.41], [0.53, 0.4], [0.62, 0.42], [0.665, 0.43], [0.712, 0.42], [0.72, 0.4]],
  /** the rows of the mesh, denser round the sockets and the teeth */
  rows: [0, 0.025, 0.06, 0.12, 0.2, 0.28, 0.335, 0.375, 0.43, 0.49, 0.555, 0.62, 0.665, 0.712, 0.72],
  /** its columns across, as shares of the half width */
  columns: [-1, -0.84, -0.64, -0.46, -0.3, -0.14, 0, 0.14, 0.3, 0.46, 0.64, 0.84, 1],
} satisfies Record<string, ReadonlyArray<number> | Table>
const jaw = {
  width: [[0.72, 0.2], [0.775, 0.205], [0.85, 0.19], [0.92, 0.14], [1, 0.09]],
  depth: [[0.72, 0.4], [0.728, 0.41], [0.775, 0.41], [0.85, 0.385], [0.92, 0.395], [1, 0.3]],
  rows: [0.72, 0.728, 0.775, 0.85, 0.92, 1],
  columns: [-1, -0.8, -0.55, -0.3, 0, 0.3, 0.55, 0.8, 1],
} satisfies Record<string, ReadonlyArray<number> | Table>
const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
/** 1 at the middle of an ellipse of the radii the offsets are divided by, falling smoothly to 0 at its edge */
const bump = (dx: number, dy: number) => smooth(1, 0, Math.hypot(dx, dy))
const superellipse = (a: number, b: number, power: number) => (Math.abs(a) ** power + Math.abs(b) ** power) ** (1 / power)
const sample = (table: Table, t: number) => {
  const next = table.findIndex(([at]) => at >= t)
  if (next <= 0) {
    return next === 0 ? table[0][1] : table.at(-1)![1]
  }
  const [t0, v0] = table[next - 1]
  const [t1, v1] = table[next]
  return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
}
/** how far inside a socket a point lies: below 1 within it */
const orbitAt = (x: number, y: number) => {
  const {orbit} = anatomy
  const dx = Math.abs(x) - orbit.x
  return superellipse(dx / orbit.halfWidth, (y - orbit.y + dx * orbit.droop) / orbit.halfHeight, 2.6)
}
/** how far inside the nasal hole a point lies: below 1 within it */
const noseAt = (x: number, y: number) => {
  const {nose} = anatomy
  const v = (y - nose.y) / nose.halfHeight
  return superellipse(x / (nose.bottom + (nose.top - nose.bottom) * smooth(-0.6, 1, v)), v, 2.5)
}
/** how deep the sockets and the nasal hole sink at the point */
const pits = (x: number, y: number) => anatomy.orbit.depth * smooth(1.08, 0.55, orbitAt(x, y)) + anatomy.nose.depth * smooth(1.05, 0.6, noseAt(x, y))
/** The bone’s surface round the sockets and the nose: the brow ridge, the cheekbones, the hollow temples, the dental arch curving back and, on the jaw, the chin. */
const relief = (x: number, y: number, isJaw: boolean) => {
  const side = Math.abs(x)
  const arch = 0.06 * Math.min(1, (x / 0.2) ** 2)
  if (isJaw) {
    return 0.025 * bump(x / 0.09, (y + 0.45) / 0.05) - 0.018 * bump(x / 0.1, (y + 0.335) / 0.035) - arch * smooth(-0.3, -0.24, y)
  }
  return 0.03 * bump((side - 0.13) / 0.13, (y - 0.155) / 0.035)
    + 0.012 * bump(x / 0.05, (y - 0.135) / 0.045)
    + 0.014 * bump(x / 0.035, y / 0.05)
    + 0.05 * bump((side - 0.22) / 0.09, (y + 0.03) / 0.07)
    - 0.06 * bump((side - 0.29) / 0.07, (y - 0.08) / 0.13)
    - 0.045 * bump((side - 0.17) / 0.07, (y + 0.14) / 0.05)
    - arch * smooth(-0.1, -0.17, y)
    - pits(x, y)
}
/** A human skull `height` meters from crown to chin as an ornament, facing +z, its middle at the origin and its foot on z = 0, in two sheets of its own rows and columns: the cranium with the upper teeth, ornament kind 0, and the jaw, kind 1. Its own coordinates are meters from its middle seen from the front. */
export function skull(height: number) {
  return {
    cranium: skullSheet(crown, height, false),
    mandible: skullSheet(jaw, height, true),
  }
}

/**
 * One piece of a skull as a sheet over its front, `height` meters from crown to chin: rows down it and columns across, round over the cheeks and the temples into its edge, which sinks below its foot. The rows narrow to the outline in `parts.width`; how far forward every point comes is the middle’s depth rounded off toward the edge, with the features of {@link relief} on it.
 */
function skullSheet(parts: typeof crown | typeof jaw, height: number, isJaw: boolean) {
  const position: Array<number> = []
  const {rows, columns} = parts
  for (const [row, t] of rows.entries()) {
    const halfWidth = sample(parts.width, t)
    const depth = sample(parts.depth, t)
    // Round over the crown, flatter across the face.
    const power = 2 + smooth(0.15, 0.35, t) * 0.8
    for (const [column, share] of columns.entries()) {
      const x = share * halfWidth
      const y = 0.5 - t
      const edge = row === 0 || row === rows.length - 1 || column === 0 || column === columns.length - 1
      const z = edge ? anatomy.rim : Math.max(anatomy.rim, depth * (1 - Math.abs(share) ** power) ** (1 / power) + relief(x, y, isJaw))
      position.push(x * height, y * height, z * height)
    }
  }
  const index: Array<number> = []
  const at = (row: number, column: number) => row * columns.length + column
  for (let row = 0; row < rows.length - 1; row++) {
    for (let column = 0; column < columns.length - 1; column++) {
      // Down, then right: counterclockwise as seen from the front.
      index.push(at(row, column), at(row + 1, column), at(row + 1, column + 1), at(row, column), at(row + 1, column + 1), at(row, column + 1))
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return ornament(geometry, {
    kind: isJaw ? 1 : 0,
    // The sockets and the nasal hole count as hollow, besides the faces turning away.
    cavity: (normal, point) => Math.max(-1, Math.min(1, pits(point.x / height, point.y / height) * 4 + (0.35 - normal.z) * 0.5)),
  })
}
