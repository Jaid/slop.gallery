import type Carving from './Carving.ts'
import type {Inlay, Ring} from './Carving.ts'

import {Vector3} from 'three/webgpu'

const bell = (n: number) => Math.exp(-n * n)
const ease = (n: number) => {
  const t = Math.max(0, Math.min(1, n))
  return t * t * (3 - 2 * t)
}
const eyeY = (side: number) => 3.37 + side * 0.009
const smileHeight = 2.876
const smileRise = (x: number) => 0.09 * (Math.abs(x) / 0.25) ** 2.2 + 0.022 * x
const cheekX = 0.222
const eyeX = 0.204
/** Relief cut directly into the front of the log, not a mask laid over the cylinder. */
function relief(x: number, y: number) {
  const a = Math.abs(x)
  const s = Math.sign(x)
  const eye = eyeY(s)
  const u = (a - eyeX) / 0.177
  const brow = eye + 0.166 + 0.075 * (1 - u * u) - 0.022 * u
  // The brow overhangs the orbit. Full cheeks below the hollow curl up around the temples.
  const browSpan = bell(u ** 3)
  let z = browSpan * (0.099 * bell((y - brow) / (y < brow ? 0.032 : 0.048)) + 0.03 * bell((y - brow - 0.024) / 0.076))
  z -= 0.067 * bell((a - eyeX) / 0.15) * bell((y - eye) / 0.17)
  z += 0.136 * bell((a - cheekX) / 0.163) * bell((y - 3.126 - 0.12 * a) / 0.126)
  // A long bridge spreads into a pear-shaped tip with a turned-under edge and two scooped nostrils.
  const width = 0.052 + 0.032 * bell((y - 3.12) / 0.09)
  z += 0.167 * bell(x / width) * bell((y - 3.28) / 0.245)
  z += 0.165 * bell(x / 0.071) * bell((y - 3.1) / (y < 3.1 ? 0.041 : 0.085))
  z += 0.118 * bell((a - 0.077) / 0.037) * bell((y - 3.083) / 0.041)
  z -= 0.06 * bell((a - 0.06) / 0.02) * bell((y - 3.059) / 0.014)
  // Incise the smile between the two lip planes and let it die into dimples, a little higher at one corner.
  const smile = smileHeight + smileRise(x)
  const lip = y - smile
  const span = bell((x / 0.245) ** 4)
  z += 0.062 * bell(x / 0.215) * bell((y - 2.9) / 0.133)
  z += span * (0.052 * bell((lip - 0.023 - 0.01 * bell((a - 0.054) / 0.032)) / 0.026) + 0.057 * bell((lip + 0.035) / 0.04) - 0.035 * bell(lip / 0.014))
  z -= 0.038 * bell((a - 0.248) / 0.032) * bell((y - smile) / 0.032)
  z += 0.089 * bell(x / 0.159) * bell((y - 2.744) / 0.089)
  return z
}
const radiusX = (y: number) => 0.343 + 0.104 * ease((y - 1.45) / 1.83) + 0.032 * bell((y - 3.115) / 0.108) - 0.01 * bell((y - 2.79) / 0.15)
const radiusZ = (y: number) => 0.303 + 0.084 * ease((y - 1.45) / 1.75)
const front = (x: number, y: number) => radiusZ(y) * Math.sqrt(Math.max(0, 1 - (x / radiusX(y)) ** 2)) + relief(x, y)
export default function carveLog(stone: Carving) {
  // Spend the columns and rows on the face; the back and the long, gently tapered belly need far fewer.
  const angles = [...Array.from({length: 66}, (_, i) => -1.2 + 2.4 * i / 66), ...Array.from({length: 24}, (_, i) => 1.2 + (Math.PI * 2 - 2.4) * i / 24)]
  const coarse = angles.filter((_, i) => i % 2 === 0)
  const heights = [1.456, 1.459, 1.468, 1.485, 1.52, 1.63, 1.81, 2.02, 2.23, 2.42, 2.55, ...Array.from({length: 83}, (_, i) => 2.6 + 1.1 * i / 82), 3.76, 3.81]
  const rows = heights.map((height, i) => (height >= 2.6 && height <= 3.7 ? angles : coarse).map(theta => {
    const bevel = [0.022, 0.012, 0.003][i] ?? 0
    const sin = Math.sin(theta)
    const column = radiusX(height) * sin
    // Bend the rows along the lip before cutting it. A deep, narrow smile sampled on horizontal lines would show little sawteeth.
    const y = height + smileRise(column) * bell((height - smileHeight) / 0.17) * bell((column / 0.3) ** 6) * ease(Math.cos(theta) / 0.32)
    // Long, shallow drawknife marks in the stripped trunk. Fade the tooling out over the polished face.
    const grain = (0.004 * Math.sin(11 * theta + 0.65 * Math.sin(y * 1.8 + theta)) + 0.0028 * Math.sin(7 * theta - y)) * (1 - ease((height - 2.43) / 0.32) * ease(Math.cos(theta) / 0.4)) * ease((3.81 - height) / 0.13)
    const x = (radiusX(y) - bevel + grain) * sin
    const c = Math.cos(theta)
    const z = (radiusZ(y) - bevel + grain) * c
    return new Vector3(x, y, z + (c > 0 && y > 2.5 ? relief(x, y) * ease(c / 0.32) : 0))
  }))
  // A softly beveled end cut, still almost flat across the crown, as on a polished section of timber.
  for (let i = 1; i <= 8; i++) {
    const phi = Math.PI / 2 * i / 8
    rows.push(coarse.map(theta => new Vector3((0.31 + (radiusX(3.81) - 0.31) * Math.cos(phi)) * Math.sin(theta), 3.81 + 0.111 * Math.sin(phi), (0.255 + (radiusZ(3.81) - 0.255) * Math.cos(phi)) * Math.cos(theta))))
  }
  // Eccentric annual rings on the end cut. The V cuts fade along each course rather than drawing a target on the crown.
  const crown = rows.length - 1
  for (const radius of [0.88, 0.7, 0.49, 0.28]) {
    for (const [offset, cut] of [[0.027, 0], [0, 0.0038], [-0.021, 0]]) {
      rows.push(coarse.map(theta => {
        const r = (radius + offset) * (1 + 0.045 * Math.sin(3 * theta + radius * 2.7))
        return new Vector3(0.039 * (1 - r) + 0.31 * r * Math.sin(theta), 3.921 - cut * (0.5 + 0.5 * Math.cos(theta - 4 * radius)), 0.255 * r * Math.cos(theta))
      }))
    }
  }
  const eyes: Array<Ring> = []
  const sockets = [-1, 1].map((side): Inlay => ({
    bottom: heights.findIndex(y => y >= eyeY(side) - 0.182),
    top: heights.findIndex(y => y >= eyeY(side) + 0.195),
    left: side < 0 ? 2 : 34,
    right: side < 0 ? 32 : 64,
    recess(boundary) {
      const eye = carveEye(side, boundary)
      eyes.push(...eye.envelope)
      return eye.surface
    },
  }))
  stone.loft(rows, sockets)
  const split = heights.indexOf(2.55)
  stone.hull(rows.slice(0, split + 1))
  stone.hull(rows.slice(split, crown + 1).filter((_, i) => i % 3 === 0 || i === crown - split), eyes)
}

/** The sculptor’s trick for an unpainted gaze: drill the pupil, leave a small stone catchlight on its overhanging lip and incise the iris around it. */
function carveEye(side: number, boundary: Ring) {
  const cx = side * eyeX
  const cy = eyeY(side)
  // Follow rays inward from the actual cut in the cylinder; no eye shells intersect it and no hidden backs shadow the lids.
  const directions = boundary.filter((_, j) => j % 2 === 0).map(p => {
    const a = Math.atan2((p.y - cy) / 0.155, (p.x - cx) / 0.183)
    return [Math.cos(a), Math.sin(a)]
  })
  const point = (dx: number, dy: number, blend: number, out: number) => {
    const seat = front(cx + dx, cy + dy)
    const globe = 0.29 - 0.37 * side * dx + 0.17 * Math.sqrt(Math.max(0, 1 - (dx / 0.181) ** 2 - (dy / 0.165) ** 2))
    return new Vector3(cx + dx, cy + dy, seat + (globe - seat) * blend + out)
  }
  const lidHeight = (c: number, s: number, up: number, down: number) => s * (s > 0 ? up : down) * (1 - 0.15 * c * c) + 0.012 * c * side
  // Roll the upper lid out over the eye. The lower lid is thinner and almost disappears at the corners.
  const lids = [
    [0.183, 0.17, 0.144, 0, 0],
    [0.176, 0.159, 0.135, 0.23, 0.004],
    [0.168, 0.145, 0.125, 0.55, 0.005],
    [0.163, 0.131, 0.119, 0.78, 0.02],
    [0.157, 0.118, 0.113, 0.94, 0.024],
    [0.153, 0.11, 0.109, 1, 0.015],
    [0.152, 0.105, 0.107, 1, 0.001],
  ].map(([w, up, down, blend, thickness]) => directions.map(([c, s]) => point(c * w, lidHeight(c, s, up, down), blend, thickness * (0.28 + 0.72 * Math.abs(s) ** 0.7) * (s > 0 ? 1 : 0.65))))
  const irisRadius = 0.076
  // Interpolate between corresponding points on the almond aperture and the offset circular iris so the globe never folds over, even at the tear duct.
  const whites = [0.139, 0.119, 0.096].map(w => directions.map(([c, s]) => {
    const t = (0.152 - w) / (0.152 - irisRadius)
    return point(c * w - side * 0.022 * t, (1 - t) * lidHeight(c, s, 0.105, 0.107) + t * (s * irisRadius + 0.004), 1, 0)
  }))
  const iris = [[irisRadius, 0], [0.072, -0.005], [0.068, 0.001], [0.054, 0.003], [0.039, 0.004], [0.035, 0.001], [0.031, -0.026], [0.021, -0.036], [0.009, -0.041]].map(([r, cut]) => directions.map(([c, s]) => {
    // Only a sliver at the rim of the pupil stays uncut, never a spike in the bottom of the cup.
    const glint = r === 0.031 ? 0.022 * bell((c + 0.64) / 0.27) * Math.max(0, s) : 0
    return point(c * r - side * 0.022, s * r + 0.004, 1, cut + glint)
  }))
  return {
    surface: [...lids, ...whites, ...iris],
    envelope: [lids.at(-2)!, iris[4]],
  }
}
