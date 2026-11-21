import type Carving from './Carving.ts'

import {CatmullRomCurve3, Vector3} from 'three/webgpu'

import {ring} from './Carving.ts'

/** Horizontal oval sections, in meters: [height, sideways, forward, half-width, half-depth]. */
type Section = [y: number, x: number, z: number, width: number, depth: number]
export default function carveFigure(stone: Carving) {
  for (const side of [-1, 1]) {
    leg(stone, side)
    arm(stone, side)
  }
  beater(stone)
}

function sections(profile: Array<Section>, sides: number) {
  return profile.map(([y, x, z, width, depth]) => ring(sides, angle => new Vector3(x + width * Math.sin(angle), y, z + depth * Math.cos(angle))))
}
/** A tapered digit, curving from the embedded root through the knuckles to the pad. */
function digit(stone: Carving, knots: Array<[x: number, y: number, z: number, radius: number]>, pose: (point: Vector3) => Vector3) {
  const path = new CatmullRomCurve3(knots.map(([x, y, z]) => new Vector3(x, y, z)))
  const count = (knots.length - 1) * 3
  const rows = Array.from({length: count + 1}, (_, i) => {
    const t = i / count
    const center = path.getPoint(t)
    const axis = path.getTangent(t)
    const j = Math.min(Math.floor(i / 3), knots.length - 2)
    const radius = knots[j][3] + (knots[j + 1][3] - knots[j][3]) * (i / 3 - j)
    const across = new Vector3(0, 0, 1)
    across.cross(axis).normalize()
    const deep = new Vector3
    deep.crossVectors(axis, across)
    return ring(10, a => center.clone().addScaledVector(across, radius * Math.cos(a)).addScaledVector(deep, radius * Math.sin(a))).map(pose)
  })
  stone.loft(rows)
  return rows.filter((_, i) => i % 3 === 0)
}
function leg(stone: Carving, side: number) {
  // The instep flows all the way into the shin. Splay the foot from the ankle, one half a step ahead of the other.
  const offset = 0.041 * side
  const foot = (p: Vector3) => {
    const arch = 0.035 * Math.max(0, Math.min(1, -p.x / 0.1)) ** 2 * Math.exp(-((p.z / 0.117) ** 2)) * Math.max(0, 1 - p.y / 0.14)
    return new Vector3(side * (0.195 + p.x + 0.22 * p.z), p.y + arch, p.z + offset)
  }
  const rows = sections([
    [0, 0, 0.072, 0.111, 0.203],
    [0.007, 0, 0.076, 0.13, 0.22],
    [0.031, 0, 0.08, 0.138, 0.231],
    [0.063, 0, 0.077, 0.141, 0.228],
    [0.088, 0, 0.061, 0.133, 0.216],
    [0.112, 0, 0.035, 0.122, 0.185],
    [0.152, 0, -0.004, 0.098, 0.142],
    [0.201, 0, -0.026, 0.076, 0.097],
    [0.254, 0, -0.023, 0.069, 0.082],
    [0.32, -0.002, -0.019, 0.067, 0.078],
    [0.425, -0.004, -0.019, 0.069, 0.077],
    [0.61, -0.008, -0.028, 0.08, 0.09],
    [0.763, -0.011, -0.021, 0.087, 0.102],
    [0.873, -0.015, 0.005, 0.078, 0.087],
    [0.953, -0.017, 0.029, 0.083, 0.091],
    [0.994, -0.017, 0.036, 0.087, 0.094],
    [1.037, -0.018, 0.032, 0.087, 0.092],
    [1.11, -0.018, 0.019, 0.084, 0.091],
    [1.27, -0.02, 0.002, 0.092, 0.102],
    [1.451, -0.023, -0.002, 0.112, 0.118],
    [1.5, -0.024, -0.002, 0.114, 0.118],
  ], 22).map(row => (side < 0 ? row.toReversed() : row).map(foot))
  stone.loft(rows)
  // A broad ball and five separate, graduated toes, not five balls stuck to the front of a shoe.
  const toes = [0.047, 0.033, 0.03, 0.026, 0.024].flatMap((width, i) => {
    const x = [-0.097, -0.032, 0.024, 0.075, 0.117][i]
    const end = 0.42 - 0.02 * i - 0.0022 * i ** 2
    const start = 0.126
    const toe = [[0, 0.35], [0.25, 0.88], [0.48, 1.05], [0.62, 0.91], [0.76, 0.97], [0.88, 1], [0.95, 0.87], [0.99, 0.52], [1, 0.18]].map(([t, r]) => {
      const loop = ring(14, a => foot(new Vector3(x * (0.8 + 0.27 * t) + r * width * Math.cos(a), Math.max(0, 0.047 + (0.009 - 0.004 * i) * (1 - t) + r * width * 0.9 * Math.sin(a) - 0.017 * t), start + (end - start) * t)))
      return side < 0 ? loop.toReversed() : loop
    })
    stone.loft(toe)
    return [toe[4], toe[7]]
  })
  stone.hull(rows.slice(0, 9), toes)
  stone.hull(rows.slice(8, 16))
  stone.hull(rows.slice(15))
}
function arm(stone: Carving, side: number) {
  const grip = side < 0
  const palmZ = grip ? 0.101 : 0.139
  const palmX = grip ? 0.524 : 0.493
  // The open palm turns toward the thigh, but not completely edge-on to the doorway.
  const pose = (p: Vector3) => {
    const turn = grip ? 0 : -0.59 * Math.max(0, Math.min(1, (1.81 - p.y) / 0.13))
    const x = p.x - palmX
    const z = p.z - palmZ
    return p.set(palmX + x * Math.cos(turn) + z * Math.sin(turn), p.y, palmZ + z * Math.cos(turn) - x * Math.sin(turn))
  }
  const rows = sections([
    [1.564, palmX, palmZ + 0.009, 0.03, 0.059],
    [1.584, palmX, palmZ + 0.006, 0.043, 0.077],
    [1.627, palmX + 0.006, palmZ, 0.049, 0.08],
    [1.678, palmX + 0.002, palmZ - 0.003, 0.043, 0.071],
    [1.732, palmX - 0.005, palmZ - 0.018, 0.038, 0.052],
    [1.779, palmX - 0.005, palmZ - 0.032, 0.04, 0.048],
    [1.91, 0.528, 0.011, 0.048, 0.053],
    [2.045, 0.555, -0.082, 0.06, 0.06],
    [2.104, 0.557, -0.095, 0.06, 0.064],
    [2.152, 0.548, -0.086, 0.06, 0.06],
    [2.273, 0.501, -0.056, 0.067, 0.07],
    [2.411, 0.45, -0.032, 0.079, 0.086],
    [2.478, 0.421, -0.017, 0.082, 0.089],
    [2.525, 0.398, -0.011, 0.068, 0.075],
    [2.55, 0.366, -0.008, 0.034, 0.047],
  ].map(([y, x, z, w, d]) => [y, side * x, z, w, d]), 20).map(row => row.map(pose))
  stone.loft(rows)
  const fingers = [0, 1, 2, 3].flatMap(i => {
    if (grip) {
      // Descending around the sloping handle, the four bent knuckles seen beyond it and their pads returning underneath.
      const y = 1.681 - i * 0.033
      const x = -0.464 - i * 0.0145
      const z = 0.134 + i * 0.004
      return digit(stone, [[x - 0.057, y + 0.01, z - 0.02, 0.022], [x - 0.057, y, z + 0.031, 0.022], [x - 0.028, y - 0.012, z + 0.058, 0.021], [x + 0.015, y - 0.021, z + 0.051, 0.019], [x + 0.035, y - 0.021, z + 0.023, 0.009]], pose)
    }
    const z = palmZ + 0.06 - 0.036 * i
    const end = [1.428, 1.41, 1.429, 1.462][i]
    return digit(stone, [[0.492, 1.61, z, 0.022], [0.497, 1.55, z, 0.022], [0.486, end + 0.045, z + 0.005, 0.02], [0.46, end + 0.013, z + 0.014, 0.018], [0.446, end, z + 0.017, 0.007]], pose)
  })
  const thumb = digit(stone, grip ? [[-0.509, 1.697, 0.101, 0.029], [-0.481, 1.715, 0.087, 0.029], [-0.437, 1.726, 0.105, 0.027], [-0.423, 1.701, 0.147, 0.024], [-0.442, 1.678, 0.172, 0.013]] : [[0.484, 1.681, 0.171, 0.032], [0.468, 1.645, 0.207, 0.029], [0.443, 1.601, 0.241, 0.026], [0.423, 1.558, 0.247, 0.021], [0.421, 1.54, 0.238, 0.008]], pose)
  stone.hull(rows.slice(0, 6), [...fingers, ...thumb])
  stone.hull(rows.slice(5, 9))
  stone.hull(rows.slice(8))
}
/** Turned beater, barrel down. The narrow end emerges from the fist in a little flared pommel. */
function beater(stone: Carving) {
  const butt = new Vector3(-1.155, 0.014, 0.401)
  const axis = new Vector3(-0.463, 1.684, 0.133)
  axis.sub(butt).normalize()
  const across = new Vector3(1, 0, 0)
  across.cross(axis).normalize()
  const deep = new Vector3
  deep.crossVectors(axis, across)
  const rows = [[0, 0.02], [0.004, 0.043], [0.014, 0.07], [0.035, 0.098], [0.06, 0.116], [0.095, 0.127], [0.137, 0.131], [0.255, 0.128], [0.45, 0.116], [0.69, 0.096], [0.93, 0.073], [1.19, 0.054], [1.47, 0.042], [1.71, 0.04], [1.88, 0.042], [1.918, 0.044], [1.93, 0.053], [1.94, 0.057], [1.96, 0.057], [1.97, 0.05], [1.974, 0.037]].map(([at, r]) => ring(32, a => {
    const p = butt.clone().addScaledVector(axis, at).addScaledVector(across, r * Math.cos(a)).addScaledVector(deep, r * Math.sin(a))
    p.y = Math.max(0, p.y)
    return p
  }))
  stone.loft(rows)
  stone.hull(rows.slice(0, 12))
  stone.hull(rows.slice(11))
}
