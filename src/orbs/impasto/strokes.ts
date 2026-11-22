import FatedRandom from 'fated-random'
import {SimplexNoise} from 'three/addons/math/SimplexNoise.js'
import {Color, MathUtils} from 'three/webgpu'

import {impastoPaints} from '#src/lib/materials/impastoPaints.ts'

const {lerp, smoothstep} = MathUtils
const tau = Math.PI * 2

/** All dimensions of the painting are in glass radii. The clear margin stays even when seen through the bent ray. */
export const groundRadius = 0.708
/** Maximum rise above the ground sphere, including the dry scumble. */
export const reliefLimit = 0.136
/** Low enough that an unoccupied glass rim remains visible instead of magnifying the painting to the edge. */
export const fillIor = 1.16

const {alizarinCrimson, cadmiumOrange, cobaltTeal, naplesYellow, titaniumWhite} = impastoPaints
// Body and streak colors, like a knife loaded with two paints and pulled without mixing them first.
const pigments = {
  blue: ['#1b477a', '#7cb7c6'],
  ember: [alizarinCrimson, '#f69e76'],
  foam: [titaniumWhite, '#71b4b6'],
  gold: [naplesYellow, '#ffedb0'],
  persimmon: [cadmiumOrange, '#ffad71'],
  tide: [cobaltTeal, '#a0d9bc'],
} as const

type Pigment = keyof typeof pigments
type Cut = readonly [start: number, end: number, pigment: Pigment, weight: number]

// The painting unrolled: loaded, broken sweeps, with shorter marks between them. A row owns a latitude
// interval and each stroke owns a longitude interval inside it. Warp this entire chart, not the individual
// cells, so every change of direction leaves the neighboring footprints disjoint, even at longitude zero.
export const impastoSweeps: ReadonlyArray<readonly [south: number, north: number, cuts: ReadonlyArray<Cut>]> = [
  [0.045, 0.166, [[0.13, 0.44, 'blue', 0.77], [0.45, 0.71, 'tide', 0.9], [0.72, 1.12, 'blue', 0.75]]],
  [0.167, 0.335, [[0.03, 0.37, 'tide', 0.94], [0.38, 0.52, 'blue', 0.79], [0.53, 0.83, 'tide', 0.97], [0.841, 1.016, 'foam', 0.64]]],
  [0.337, 0.526, [[0.11, 0.3, 'ember', 0.97], [0.31, 0.68, 'blue', 1], [0.687, 0.8, 'foam', 0.7], [0.813, 1.099, 'blue', 0.94]]],
  [0.528, 0.694, [[0.043, 0.29, 'foam', 0.94], [0.3, 0.423, 'gold', 0.76], [0.431, 0.765, 'foam', 0.96], [0.776, 1.031, 'tide', 0.85]]],
  [0.696, 0.841, [[0.174, 0.49, 'persimmon', 0.96], [0.502, 0.9, 'gold', 0.96], [0.912, 1.165, 'ember', 0.85]]],
  [0.843, 0.966, [[0.095, 0.345, 'gold', 0.56], [0.36, 0.66, 'ember', 0.76], [0.676, 1.082, 'foam', 0.68]]],
]

const colors = Object.fromEntries(Object.entries(pigments).map(([name, [body, accent]]) => [name, [new Color(body), new Color(accent)]])) as Record<Pigment, [Color, Color]>
const gessoLight = new Color('#e1cab0')
const ochreWash = new Color('#b96a5a')
const indigoWash = new Color('#3e6289')
const celadonWash = new Color('#73a9aa')
const grainRandom = new FatedRandom({
  id: 'impasto-ground',
  seed: 0,
})
const grain = new SimplexNoise({random: () => grainRandom.next().roll()})

/** Longitude and latitude of a unit vector, before the chart warp. The longitude repeats at 0/1. */
export function impastoSurface(u: number, v: number, color: Color, streak: Color) {
  const longitude = (MathUtils.euclideanModulo(u, 1) - 0.5) * tau
  const latitude = (v - 0.5) * Math.PI
  const ring = v > 0 && v < 1 ? Math.cos(latitude) : 0
  const x = Math.cos(longitude) * ring
  const y = Math.sin(latitude)
  const z = Math.sin(longitude) * ring
  // The bend stays below 1/π, so latitude never folds back. Longitude is then only a shift at each warped latitude.
  const bend = 0.142 * Math.sin(longitude + 0.84) + 0.057 * Math.sin(2 * longitude - 0.88) + 0.019 * Math.sin(3 * longitude + 1.12)
  const warpedV = v + bend * ring
  const warpedU = MathUtils.euclideanModulo(u + 0.45 * (warpedV - 0.5) + 0.035 * Math.sin(8 * warpedV), 1)
  // An underpainting in thin, rubbed layers of indigo, celadon and apricot. Its long drag marks
  // carry on between the thicker gestures, so the exposed ground still belongs to the painting.
  const wave = warpedV + 0.021 * Math.sin(14 * x + 6 * z) + 0.009 * Math.sin(27 * x - 21 * z + 30 * y)
  const cloud = grain.noise3d(5 * x, 6 * wave, 5 * z)
  const drag = grain.noise3d(8 * x + cloud * 0.4, 60 * wave, 8 * z)
  const tooth = grain.noise3d(21 * x, 161 * wave, 21 * z)
  const scumble = smoothstep(drag + 0.22 * tooth + 0.25 * cloud, -0.55, 0.62)
  const fleck = grain.noise3d(140 * x, 140 * y, 140 * z)
  const ground = groundRadius + 0.0032 * scumble * (0.8 + 0.2 * fleck)
  color.lerpColors(indigoWash, celadonWash, smoothstep(wave + 0.06 * cloud, 0.27, 0.64))
  color.lerp(ochreWash, smoothstep(wave + 0.036 * drag, 0.64, 0.92))
  color.lerp(gessoLight, scumble * (0.34 + 0.24 * smoothstep(wave, 0.31, 0.66))).multiplyScalar(1 + fleck * 0.14)
  for (const [south, north, cuts] of impastoSweeps) {
    if (warpedV <= south || warpedV >= north) {
      continue
    }
    for (const [start, end, pigment, weight] of cuts) {
      const cut = MathUtils.euclideanModulo(warpedU - start, 1) / (end - start)
      if (cut >= 1) {
        continue
      }
      const phase = start * 39 + south * 52
      // Some marks are pulled against the sweep, leaving the scraped end on the other side.
      const s = Math.sin(phase) > 0.55 ? 1 - cut : cut
      const arc = 0.29 * Math.sin(4.1 * s + phase) + 0.12 * Math.sin(7 * s - phase)
      const t = (warpedV - south) * 2 / (north - south) - 1 - arc
      const fray = 0.03 * Math.sin(49 * s + phase) + 0.017 * Math.sin(109 * s - phase)
      const fan = 0.84 + 0.18 * Math.sin(s * 3.3 + 0.2) + 0.06 * Math.sin(9 * s + phase)
      const width = (1 - Math.abs(arc)) * Math.min(0.98, fan + fray - 0.52 * smoothstep(s, 0.64, 1))
      const across = t / width
      if (Math.abs(across) >= 1) {
        return ground
      }
      // The knife presses an uneven thick lip into one edge. As it lifts, the paint thins into parallel
      // striations; different tracks run out of pigment at different points along the scraped tail.
      const track = (across * (0.93 + 0.12 * Math.sin(4 * s + phase)) + 0.09 * Math.sin(6 * s + phase) + 0.06 * Math.sin(11 * s - phase) + 0.053 * Math.sin(5 * across + phase)) * Math.PI
      const folds = 0.5 + 0.5 * Math.sin(4.5 * track + phase + s * 4)
      const striae = (0.5 + 0.5 * Math.sin(8.3 * track - 3 * s + phase)) ** 3
      const crest = 0.017 + 0.2 * across ** 2 + 0.037 * across + 0.019 * (1 + Math.sin(3 * track))
      const head = smoothstep(s, crest, crest + 0.089)
      const tail = 1 - smoothstep(s, 0.58 + 0.08 * folds, 0.94 + 0.04 * folds)
      const shoulder = 1 - smoothstep(Math.abs(across), 0.66 + 0.1 * Math.sin(7 * s + phase), 1)
      const relief = head * tail * shoulder
      const skim = smoothstep(s, 0.003, 0.09) * (1 - smoothstep(s, 0.9, 0.995)) * (1 - smoothstep(Math.abs(across), 0.89, 1))
      const lip = 0.5 + 0.5 * Math.sin(across * 2 + phase)
      const dragged = folds * (0.58 + 0.42 * Math.sin(3 * s + phase + across) ** 2)
      const height = weight * relief * (0.034 + 0.051 * lip + 0.033 * dragged + 0.008 * striae) * (1 - 0.36 * s)
      // Broken ribbons of the previous color become part of the paint, not straight lines drawn over it.
      const [body, accent] = colors[pigment]
      const ribbon = smoothstep(Math.sin(2.1 * track + 2.8 * s + phase) + 0.32 * Math.sin(6.5 * track - 2 * s), 0.42, 1.15)
      streak.lerpColors(body, accent, 0.08 + 0.72 * ribbon + 0.16 * striae)
      streak.multiplyScalar(lerp(0.89, 1, smoothstep(relief, 0, 0.6)) * (0.9 + 0.14 * folds + 0.065 * fleck))
      color.lerp(streak, lerp(skim * (0.16 + 0.38 * scumble), 1, smoothstep(relief, 0, 0.5)))
      return ground + height
    }
    break
  }
  return ground
}
