import type SahurMesh from './SahurMesh.ts'
import type {Vec3} from 'math'

import {Color, MathUtils, Vector3} from 'three/webgpu'

import {tau} from './SahurMesh.ts'

const {lerp, smoothstep} = MathUtils
const foot = 1.376
const crown = 3.74
const eyeY = 3.145
const eyeX = 0.174
const honey = new Color('#c3894b')
const endGrain = new Color('#c59459')
const sapwood = new Color('#dfad6b')
const amber = new Color('#a25a31')
const groove = new Color('#432014')
const brows = new Color('#54301c')
const ivory = new Color('#f5e4cb')
const umber = new Color('#523020')
const ocher = new Color('#a06438')
const pupil = new Color('#170d08')
const limbal = new Color('#321a11')
export function carveLog(mesh: SahurMesh) {
  const sides = 96
  // More rings at the lids, nostrils and lips than along the uncut waist or the end grain.
  const spans = [[1.41, 4], [1.52, 4], [2.42, 8], [2.63, 8], [2.91, 21], [3.32, 23], [3.51, 14], [3.67, 6], [3.718, 4], [crown, 4]] as const
  const tint = new Color
  const pole = (y: number) => [mesh.vertex(new Vector3(0, y, 0), endGrain, logGrain(0, y, 0))]
  const rows = [pole(foot)]
  const ring = (baseY: number, scale = 1) => {
    const [width, depth] = logRadii(baseY)
    const next = Array.from({length: sides}, (_, j) => {
      const u = tau * j / sides
      const angle = u - 0.62 * Math.sin(u)
      const x = -Math.sin(angle) * width * scale
      // Follow the smile and eyebrow with the mesh so the narrow cuts stay crisp at this resolution.
      const facing = Math.max(0, Math.cos(angle))
      const y = baseY <= 2.42 || baseY >= 3.67 ? baseY : baseY + facing * (bell(baseY, smile(0), 0.087) * lipSpan(x) * (smile(x) - smile(0)) + bell(baseY, 3.424, 0.102) * (browY(x) - 3.424))
      const z = Math.cos(angle) >= 0 ? front(x / scale, y) * scale : -depth * Math.abs(Math.cos(angle)) ** 0.91 * scale
      const point = new Vector3(x, y, z)
      logTint(x, y, z, tint)
      tint.lerp(endGrain, 0.77 * (1 - smoothstep(scale, 0.5, 1)))
      return mesh.vertex(point, tint, logGrain(x, y, z))
    })
    mesh.band(rows.at(-1)!, next)
    rows.push(next)
  }
  ring(foot, 0.55)
  ring(foot)
  let previous = foot
  for (const [end, steps] of spans) {
    for (let i = 1; i <= steps; i++) {
      ring(lerp(previous, end, i / steps))
    }
    previous = end
  }
  ring(crown, 0.84)
  ring(crown, 0.58)
  ring(crown, 0.3)
  const top = pole(crown)
  mesh.band(rows.at(-1)!, top)
  rows.push(top)
  return rows
}
/** Convex oval inlays with circular irises, set into rounded, carved lids. */
export function inlayEyes(mesh: SahurMesh) {
  const sides = 56
  const tint = new Color
  for (const side of [-1, 1]) {
    const cx = side * eyeX
    const cy = eyeY + side * 0.009
    const iris = 0.076
    const eyeDepth = 0.363
    const center = new Vector3(cx - side * 0.012, cy + 0.005, eyeDepth + 0.088)
    let last = [mesh.vertex(center, pupil, [cy, cx, 0.3], 1)]
    const shape = [0.15, 0.31, 0.45, 0.5, 0.54, 0.62, 0.73, 0.85, 0.91, 0.97, 1, 1.035, 1.085, 1.14, 1.21, 1.29, 1.39]
    for (const t of shape) {
      const ring = Array.from({length: sides}, (_, j) => {
        const angle = tau * j / sides
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        const edge = smoothstep(t, 0.61, 1)
        const x = cx + lerp(-side * 0.012, 0, edge) + c * lerp(iris * t / 0.61, 0.131 * t, edge)
        const y = cy + lerp(0.005, c * side * 0.021, edge) + s * lerp(iris * t / 0.61, (s >= 0 ? 0.124 : 0.104) * t * (0.78 + 0.22 * Math.abs(s)), edge)
        const socket = front(x, y)
        // The iris and sclera share one convex surface; only the lip of the lid follows the skin.
        const z = t <= 1 ? lerp(eyeDepth + 0.088 * (1 - t * t), socket + 0.02, smoothstep(t, 0.78, 1)) : socket + 0.02 + 0.024 * bell(t, 1.145, 0.071) * smoothstep(t, 1, 1.12) - 0.035 * smoothstep(t, 1.21, 1.39)
        let enamel = 0
        if (t <= 0.62) {
          const rays = Math.sin(27 * angle + 19 * t) + 0.52 * Math.sin(13 * angle - 11 * t) + 0.38 * Math.sin(43 * angle + 7 * t)
          tint.copy(umber).lerp(ocher, 0.48 + 0.22 * rays).lerp(limbal, smoothstep(t, 0.5, 0.62)).lerp(pupil, 1 - smoothstep(t, 0.3, 0.365))
          enamel = 1
        } else if (t <= 1) {
          tint.copy(ivory).lerp(amber, 0.41 * smoothstep(t, 0.85, 1) + 0.08 * Math.max(0, s))
          enamel = 1
        } else {
          logTint(x, y, z, tint)
          tint.lerp(groove, 0.88 * bell(t, 1.033, 0.044)).lerp(sapwood, 0.44 * bell(t, 1.148, 0.076))
        }
        return mesh.vertex(new Vector3(x, y, z), tint, logGrain(x, y, z), enamel)
      })
      mesh.band(last, ring)
      last = ring
    }
  }
}
function logGrain(x: number, y: number, z: number): Vec3 {
  return [y, Math.hypot(x + 0.171, z + 0.092), 0.3]
}
function bell(value: number, center: number, spread: number) {
  return Math.exp(-(((value - center) / spread) ** 2))
}
function pairedBell(x: number, center: number, spread: number) {
  return bell(x, center, spread) + bell(x, -center, spread)
}
function logRadii(y: number) {
  const base = lerp(0.337, 0.409, smoothstep(y, 1.44, 2.87))
  const depth = lerp(0.287, 0.345, smoothstep(y, 1.44, 3))
  const arris = y > 3.54 ? 1 - Math.sqrt(Math.max(0, 1 - ((y - 3.54) / (crown - 3.54)) ** 2)) : (1 - smoothstep(y, foot, foot + 0.075)) * 0.39
  return [base - arris * 0.11, depth - arris * 0.095] as const
}
function smile(x: number) {
  return 2.725 + 1.52 * x * x + 0.046 * x
}
function browY(x: number) {
  return 3.374 + 0.063 * bell(Math.abs(x), 0.188, 0.107) - 0.048 * smoothstep(Math.abs(x), 0.22, 0.36) + x * 0.034
}
function brow(x: number, y: number) {
  const width = 0.022 + 0.019 * bell(Math.abs(x), 0.146, 0.089)
  return (1 - smoothstep(Math.abs(Math.abs(x) - 0.185), 0.081, 0.149)) * bell(y, browY(x), width)
}
function lipSpan(x: number) {
  return 1 - smoothstep(Math.abs(x), 0.156, 0.247)
}
function relief(x: number, y: number) {
  const a = Math.abs(x)
  const lip = lipSpan(x)
  return 0.119 * pairedBell(x, 0.237, 0.151) * bell(y, 2.965, 0.176) // lifted cheeks
    - 0.08 * pairedBell(x, eyeX, 0.118) * bell(y, eyeY, 0.102)
    + 0.04 * pairedBell(x, 0.177, 0.164) * bell(y, 3.395, 0.133) + 0.029 * brow(x, y)
    + 0.115 * bell(x, 0, 0.07) * bell(y, 3.055, 0.266) // bridge of the nose
    + 0.149 * bell(x, 0, 0.081) * bell(y, 2.881, 0.064)
    + 0.095 * pairedBell(x, 0.068, 0.045) * bell(y, 2.863, 0.044)
    - 0.023 * pairedBell(x, 0.057, 0.025) * bell(y, 2.833, 0.018)
    + 0.023 * pairedBell(x, 0.027, 0.035) * bell(y, 2.796, 0.042) // philtrum
    + lip * (0.066 * bell(y, smile(x) + 0.023, 0.034) + 0.071 * bell(y, smile(x) - 0.039, 0.04) - 0.026 * bell(y, smile(x), 0.015))
    - 0.028 * bell(a, 0.226, 0.033) * bell(y, smile(x), 0.036)
    + 0.077 * bell(x, 0, 0.195) * bell(y, 2.564, 0.123)
}
function front(x: number, y: number) {
  const [width, depth] = logRadii(y)
  const curve = Math.sqrt(Math.max(0, 1 - (x / width) ** 2))
  return depth * curve ** 0.81 + relief(x, y) * smoothstep(curve, 0.1, 0.52)
}
/** All of the large planes of the face are carved into the log, including the nose and the smile. */
function logTint(x: number, y: number, z: number, tint: Color) {
  tint.copy(honey).lerp(sapwood, 0.14 + 0.28 * smoothstep(y, 1.8, crown))
  if (z <= 0) {
    return
  }
  const a = Math.abs(x)
  const lips = lipSpan(x)
  const corner = bell(a, 0.226, 0.025) * bell(y, smile(x), 0.029)
  const nostril = bell(a, 0.063, 0.023) * bell(y, 2.837, 0.015)
  const crease = lips * bell(y, smile(x), 0.012)
  const lip = lips * (0.36 * bell(y, smile(x) + 0.022, 0.03) + 0.46 * bell(y, smile(x) - 0.035, 0.03))
  const socket = bell(a, eyeX, 0.151) * bell(y, eyeY + 0.085, 0.123)
  // Short gouge marks interrupt the dark oil rubbed into the carved brow.
  const engraved = 0.91 + 0.08 * Math.sin(293 * (a + 0.57 * y) + Math.sin(39 * y))
  tint.lerp(amber, Math.min(0.9, lip + 0.44 * socket))
    .lerp(groove, Math.min(0.95, 0.92 * crease + 0.72 * nostril + 0.59 * corner))
    .lerp(brows, engraved * smoothstep(brow(x, y), 0.16, 0.81))
}
