import type {Vec3 as Vector} from 'math'
import type {Node, Texture} from 'three/webgpu'

import {atan, bitangentView, cameraPosition, color, cos, exp, float, Fn, If, max, min, mix, modelWorldMatrixInverse, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalGeometry, normalViewGeometry, pmremTexture, positionGeometry, positionView, positionViewDirection, select, sin, smoothstep, tangentView, texture, time, uv, vec2, vec3, vec4} from 'three/tsl'
import {Color, DataTexture, FloatType, LinearFilter, RedFormat, RepeatWrapping, RGFormat} from 'three/webgpu'

import {knotGeometryArgs} from '../../geometry.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {add, cross, dot, normalize, scale, sub} from '../../lib/tripleMath.ts'
import knotData from './data.ts'

const [radius, tube,,, windingP, windingQ] = knotGeometryArgs
type TubeChartOptions = {
/** metric texels across each cell row */
  metricRows?: number
/** number of cell rows around the tube circumference */
  rows: number
/** texels along the tube */
  width?: number
}
type TubeChart = {
/** R: per-row periodic arc-length correction σ/σtotal − u; one texel row per cell row */
  arcTexture: DataTexture
/** tube circumference in object units */
  circumference: number
/** per-row cell counts along the tube, chosen for square cells on each row’s center path */
  columns: Array<number>
  metricRows: number
/** RG, metricRows texel rows per cell row: R is the physical width of one cell unit along x, relative to the nominal cell size; G is the minimum of R over the whole cell containing the texel */
  metricTexture: DataTexture
  rows: number
/** whole-row shift accumulated by the frame twist over one traversal */
  rowShift: number
/** R: periodic part Q(u) of the twist correction, so φ = v + Q(u) + rowShift / rows · u */
  twistTexture: DataTexture
}

type Point = readonly [number, number]

type StarSpec = {
  center?: boolean
  /** ear stars follow ear twitches */
  ear?: boolean
/** eyelid stars close toward the eye axis when the cat blinks */
  lid?: boolean
  /** relative star magnitude; 1 is an “alpha” star */
  magnitude: number
  name: string
  point: Point
}
/** Centerline of Three’s TorusKnotGeometry for the gallery’s winding numbers. */
function curve(angle: number): Vector {
  const phase = windingQ / windingP * angle
  const r = radius * (2 + Math.cos(phase)) * 0.5
  return [r * Math.cos(angle), r * Math.sin(angle), radius * Math.sin(phase) * 0.5]
}
/** Exact surface point for a mesh UV, mirroring TorusKnotGeometry’s chord-based frame. */
function knotSurface(u: number, v: number): Vector {
  const angle = u * windingP * TAU
  const center = curve(angle)
  const next = curve(angle + 0.01)
  const chord = sub(next, center)
  const binormal = normalize(cross(chord, add(next, center)))
  const normal = normalize(cross(binormal, chord))
  const around = v * TAU
  return add(center, add(scale(normal, -tube * Math.cos(around)), scale(binormal, tube * Math.sin(around))))
}
/** An orthogonal chart for the knot tube, built once on the CPU. Plain mesh UVs stretch up to 3× along the tube and shear by up to 60° because the tube frame twists. φ = v + W(u) follows paths that stay orthogonal to the cross-section circles, so rows never lean. Columns depend on u alone – keeping cells rectangular – and are spaced by arc length along each row’s own center path. The residual frame twist is snapped to whole rows, so the seam at u = 0/1 remains a cell boundary. */
function createTubeChart({rows, width = 2048, metricRows = 16}: TubeChartOptions): TubeChart {
  const epsilon = 1e-5
  const velocityU = (u: number, v: number) => scale(sub(knotSurface(u + epsilon, v), knotSurface(u - epsilon, v)), 0.5 / epsilon)
  const velocityV = (u: number, v: number) => scale(sub(knotSurface(u, v + epsilon), knotSurface(u, v - epsilon)), 0.5 / epsilon)
// How far a constant-v line drifts around the tube per unit u. It barely depends on v.
  const twistRate = (u: number) => {
    const samples = 32
    let sum = 0
    for (let k = 0;k < samples;k++) {
      const v = (k + 0.5) / samples
      const pv = velocityV(u, v)
      sum += dot(velocityU(u, v), pv) / dot(pv, pv)
    }
    return sum / samples
  }
  const steps = width * 4
  const cumulative = new Float64Array(steps + 1)
  let previous = twistRate(0)
  for (let i = 1;i <= steps;i++) {
    const current = twistRate(i / steps)
    cumulative[i] = cumulative[i - 1] + (previous + current) * 0.5 / steps
    previous = current
  }
  const totalTwist = cumulative[steps]
  const rowShift = Math.round(totalTwist * rows)
  const periodicTwist = (u: number) => {
    const position = u * steps
    const index = Math.min(Math.floor(position), steps - 1)
    const fraction = position - index
    return cumulative[index] * (1 - fraction) + cumulative[index + 1] * fraction - totalTwist * u
  }
// A path of constant φ; the unsnapped remainder of the twist is a uniform shear below 1°.
  const pathPoint = (u: number, phi: number) => knotSurface(u, phi - periodicTwist(u) - rowShift / rows * u)
  const twist = new Float32Array(width)
  for (let i = 0;i < width;i++) {
    twist[i] = periodicTwist((i + 0.5) / width)
  }
  const arc = new Float32Array(width * rows)
  const arcSteps = width * 4
  const circumference = TAU * tube
  const cellSize = circumference / rows
  const columns: Array<number> = []
  const totals: Array<number> = []
  for (let row = 0;row < rows;row++) {
    const phi = (row + 0.5) / rows
    const sigma = new Float64Array(arcSteps + 1)
    let last = pathPoint(0, phi)
    for (let i = 1;i <= arcSteps;i++) {
      const point = pathPoint(i / arcSteps, phi)
      sigma[i] = sigma[i - 1] + Math.hypot(...sub(point, last))
      last = point
    }
    const total = sigma[arcSteps]
    totals.push(total)
    columns.push(Math.max(1, Math.round(total / cellSize)))
    for (let i = 0;i < width;i++) {
      const u = (i + 0.5) / width
      const position = u * arcSteps
      const index = Math.floor(position)
      const fraction = position - index
      arc[row * width + i] = (sigma[index] * (1 - fraction) + sigma[index + 1] * fraction) / total - u
    }
  }
// Cells are exact squares only on each row’s center path. Away from it the tube bends the cell
// into a trapezoid; record the true local width so cats can be drawn in physical units.
  const pathSpeed = (u: number, phi: number) => Math.hypot(...sub(pathPoint(u + epsilon, phi), pathPoint(u - epsilon, phi))) / (2 * epsilon)
  const metricWidth = width / 2
  const metric = new Float32Array(metricWidth * rows * metricRows * 2)
  for (let row = 0;row < rows;row++) {
    const cellMinimum = new Map<number, number>
    const cellOf = new Int32Array(metricWidth)
    for (let i = 0;i < metricWidth;i++) {
      const u = (i + 0.5) / metricWidth
      const centerSpeed = pathSpeed(u, (row + 0.5) / rows)
// Cell unit along x in object units on the center path: σtotal / columns.
      const arcAt = arc[row * width + Math.min(width - 1, Math.floor(u * width))]
      cellOf[i] = Math.floor((u + arcAt) * columns[row]) % columns[row]
      for (let j = 0;j < metricRows;j++) {
        const phi = (row + (j + 0.5) / metricRows) / rows
        const ratio = pathSpeed(u, phi) / centerSpeed * totals[row] / columns[row] / cellSize
        metric[((row * metricRows + j) * metricWidth + i) * 2] = ratio
        cellMinimum.set(cellOf[i], Math.min(cellMinimum.get(cellOf[i]) ?? Infinity, ratio))
      }
    }
    for (let i = 0;i < metricWidth;i++) {
      for (let j = 0;j < metricRows;j++) {
        metric[((row * metricRows + j) * metricWidth + i) * 2 + 1] = cellMinimum.get(cellOf[i])!
      }
    }
  }
  const metricTexture = new DataTexture(metric, metricWidth, rows * metricRows, RGFormat, FloatType)
  const arcTexture = new DataTexture(arc, width, rows, RedFormat, FloatType)
  const twistTexture = new DataTexture(twist, width, 1, RedFormat, FloatType)
  for (const chartTexture of [arcTexture, twistTexture, metricTexture]) {
    chartTexture.wrapS = RepeatWrapping
    chartTexture.wrapT = RepeatWrapping
    chartTexture.minFilter = LinearFilter
    chartTexture.magFilter = LinearFilter
    chartTexture.generateMipmaps = false
    chartTexture.needsUpdate = true
  }
  arcTexture.name = 'Felis Major arc-length chart'
  twistTexture.name = 'Felis Major twist chart'
  metricTexture.name = 'Felis Major metric chart'
  return {
    arcTexture,
    circumference,
    columns,
    metricRows,
    metricTexture,
    rowShift,
    rows,
    twistTexture,
  }
}
/** Floor-based wrap into [0, period), safe for negative inputs. */
function wrap(value: Node<'float'>, period: Node<'float'> | number) {
  const p = typeof period === 'number' ? float(period) : period
  return value.sub(value.div(p).floor().mul(p))
}
/** Per-fragment cell coordinates on the knot: one cat per cell. Cells are square in object units, orthogonal and rectangular thanks to the tube chart, and seamless at both UV seams. With a depth, the cells are read where the refracted view ray reaches that depth below the surface, so the constellation layer floats inside the lacquer and slides as the visitor moves. */
function catCells(chart: TubeChart, {depth = 0, refraction = 1.5} = {}) {
  const tubeUv = uv()
// Surface frame in view space: y follows the circumferential direction exactly, x is orthogonal.
  const normal = normalViewGeometry.normalize()
  const bitangent = vec3(bitangentView as unknown as Node<'vec3'>)
  const yAxis = bitangent.sub(normal.mul(normal.dot(bitangent))).normalize()
  const xAxis = tangentView.sub(normal.mul(normal.dot(tangentView))).sub(yAxis.mul(yAxis.dot(tangentView))).normalize()
  const view = positionViewDirection
  const viewInCell = vec2(view.dot(xAxis), view.dot(yAxis))
// Snell: the tangential part of the ray shrinks by 1/n; slide = tan θt per unit depth.
  const sine = viewInCell.div(refraction)
  const slide = sine.div(sine.dot(sine).oneMinus().max(0.05).sqrt())
  const cellSize = chart.circumference / chart.rows
  const shift = slide.mul(depth / cellSize)
  const twist = texture(chart.twistTexture, vec2(tubeUv.x, 0.5)).r
  const phi = tubeUv.y.add(twist).add(tubeUv.x.mul(chart.rowShift / chart.rows))
  const rowCoord = phi.mul(chart.rows).sub(shift.y)
  const row = wrap(rowCoord.floor(), chart.rows)
// Each texel row stores the arc-length correction of one cell row; sample exactly at its center.
  const arc = texture(chart.arcTexture, vec2(tubeUv.x, row.add(0.5).div(chart.rows))).r
  let columns: Node<'float'> = float(chart.columns[0])
  for (const [index, count] of chart.columns.entries()) {
    if (index > 0) {
      columns = select(row.sub(index).abs().lessThan(0.5), float(count), columns)
    }
  }
  const along = tubeUv.x.add(arc).mul(columns).sub(shift.x)
  const column = wrap(along.floor(), columns)
// True local width of the cell, so cats keep their proportions where the tube bends.
  const band = rowCoord.fract().clamp(0.5 / chart.metricRows, 1 - 0.5 / chart.metricRows)
  const metric = texture(chart.metricTexture, vec2(tubeUv.x, row.add(band).div(chart.rows))).rg
  const stretch = metric.x
  const unit = vec2(along.fract().sub(0.5), rowCoord.fract().sub(0.5))
  const local = vec2(unit.x.mul(stretch), unit.y)
// physical distance to the nearest cell border
  const edgeDistance = unit.x.abs().oneMinus().sub(0.5).mul(stretch).min(unit.y.abs().oneMinus().sub(0.5))
// Pixel footprint in physical cell units, from the unwrapped (continuous) coordinates.
  const footprint = max(along.fwidth().mul(stretch), rowCoord.fwidth()).clamp(0.0004, 0.25)
  return {
    along,
    edgeDistance,
    /** half extents of the cell in physical cell units, using its narrowest width */
    halfExtent: vec2(metric.y.min(1.6).mul(0.5), 0.5),
    column,
    columns,
    footprint,
    local,
    normal,
    row,
    /** the viewer’s direction projected onto the cell plane, in cell axes */
    viewInCell,
    xAxis,
    yAxis,
  }
}
// A low-poly cat head as a constellation: stars (vertices), threads (edges) and facets.
/** Left half (x < 0) and center line of the head; +y points toward the ears. */
const specs: Array<StarSpec> = [
  {
    name: 'crown',
    point: [0, 0.262],
    magnitude: 0.55,
    center: true,
  },
  {
    name: 'bridge',
    point: [0, 0.075],
    magnitude: 0.3,
    center: true,
  },
  {
    name: 'noseTip',
    point: [0, -0.13],
    magnitude: 0.7,
    center: true,
  },
  {
    name: 'mouth',
    point: [0, -0.205],
    magnitude: 0.3,
    center: true,
  },
  {
    name: 'chin',
    point: [0, -0.325],
    magnitude: 0.55,
    center: true,
  },
  {
    name: 'earTip',
    point: [-0.36, 0.445],
    magnitude: 1,
    ear: true,
  },
  {
    name: 'earCore',
    point: [-0.3, 0.29],
    magnitude: 0.25,
    ear: true,
  },
  {
    name: 'earOuter',
    point: [-0.435, 0.165],
    magnitude: 0.55,
  },
  {
    name: 'earInner',
    point: [-0.135, 0.275],
    magnitude: 0.6,
  },
  {
    name: 'brow',
    point: [-0.215, 0.155],
    magnitude: 0.35,
  },
  {
    name: 'eyeOuter',
    point: [-0.3, 0.03],
    magnitude: 0.5,
  },
  {
    name: 'eyeTop',
    point: [-0.195, 0.075],
    magnitude: 0.3,
    lid: true,
  },
  {
    name: 'eyeInner',
    point: [-0.09, -0.025],
    magnitude: 0.5,
  },
  {
    name: 'eyeBottom',
    point: [-0.19, -0.05],
    magnitude: 0.3,
    lid: true,
  },
  {
    name: 'noseTop',
    point: [-0.05, -0.08],
    magnitude: 0.35,
  },
  {
    name: 'cheek',
    point: [-0.44, -0.075],
    magnitude: 0.65,
  },
  {
    name: 'cheekMid',
    point: [-0.285, -0.15],
    magnitude: 0.35,
  },
  {
    name: 'muzzle',
    point: [-0.13, -0.175],
    magnitude: 0.45,
  },
  {
    name: 'jaw',
    point: [-0.215, -0.28],
    magnitude: 0.5,
  },
]

type FacetKind = 'nose' | 'skin'

/** facets on the left side, mirrored automatically; winding is normalized later */
const leftFacets: Array<Array<string>> = [
  ['earTip', 'earOuter', 'earCore'],
  ['earTip', 'earCore', 'earInner'],
  ['earCore', 'earOuter', 'earInner'],
  ['earOuter', 'brow', 'earInner'],
  ['earInner', 'brow', 'crown'],
  ['crown', 'brow', 'bridge'],
  ['earOuter', 'eyeOuter', 'brow'],
  ['brow', 'eyeOuter', 'eyeTop'],
  ['brow', 'eyeTop', 'bridge'],
  ['bridge', 'eyeTop', 'eyeInner'],
  ['bridge', 'eyeInner', 'noseTop'],
  ['earOuter', 'cheek', 'eyeOuter'],
  ['eyeOuter', 'cheek', 'cheekMid'],
  ['eyeOuter', 'cheekMid', 'eyeBottom'],
  ['eyeBottom', 'cheekMid', 'muzzle'],
  ['eyeBottom', 'muzzle', 'noseTop', 'eyeInner'],
  ['noseTop', 'muzzle', 'noseTip'],
  ['noseTip', 'muzzle', 'mouth'],
  ['cheek', 'jaw', 'cheekMid'],
  ['cheekMid', 'jaw', 'muzzle'],
  ['muzzle', 'jaw', 'chin'],
  ['muzzle', 'chin', 'mouth'],
]
/** facets spanning the center line, given with explicit L/R names */
const centerFacets: Array<[FacetKind, Array<string>]> = [
  ['skin', ['bridge', 'noseTopL', 'noseTopR']],
  ['nose', ['noseTopL', 'noseTip', 'noseTopR']],
]

type Star = {
  /** −1 left ear, 1 right ear, 0 otherwise */
  ear: -1 | 0 | 1
  lid: boolean
  magnitude: number
  name: string
  point: Point
/** length-weighted graph distance from the nose tip, normalized to 0–1 */
  reach: number
}

type ThreadRank = 'eye' | 'inner' | 'outline'

type Thread = {
/** endpoints, ordered outward from the nose */
  a: number
  b: number
/** outline threads carry the silhouette; inner threads only hint at the facets */
  rank: ThreadRank
}

type Facet = {
/** facet centroid in model space */
  centroid: Point
  kind: FacetKind
/** counter-clockwise star indices */
  stars: Array<number>
}

type Whisker = {
  /** perpendicular sag at the midpoint, in model units */
  bend: number
  root: Point
  tip: Point
}

const stars: Array<Star> = []
const index = new Map<string, number>
for (const spec of specs) {
  const variants: Array<[string, -1 | 1]> = spec.center ? [[spec.name, 1]] : [[`${spec.name}L`, 1], [`${spec.name}R`, -1]]
  for (const [name, mirror] of variants) {
    index.set(name, stars.length)
    stars.push({
      name,
      point: [spec.point[0] * mirror, spec.point[1]],
      magnitude: spec.magnitude,
      ear: spec.ear ? (mirror < 0 ? 1 : -1) : 0,
      lid: Boolean(spec.lid),
      reach: 0,
    })
  }
}
const id = (name: string) => {
  const value = index.get(name)
  if (value === undefined) {
    throw new Error(`Unknown star ${name}`)
  }
  return value
}
const centerNames = new Set(specs.filter(spec => spec.center).map(spec => spec.name))
const resolve = (name: string, side: 'L' | 'R') => (centerNames.has(name) ? id(name) : id(`${name}${side}`))
const makeFacet = (members: Array<number>, kind: FacetKind): Facet => {
  let x = 0
  let y = 0
  let area = 0
  for (const [k, star] of members.entries()) {
    const [ax, ay] = stars[star].point
    const [bx, by] = stars[members[(k + 1) % members.length]].point
    x += ax
    y += ay
    area += ax * by - bx * ay
  }
  return {
    stars: area < 0 ? members.toReversed() : members,
    centroid: [x / members.length, y / members.length],
    kind,
  }
}
const facets: Array<Facet> = []
for (const facet of leftFacets) {
  facets.push(makeFacet(facet.map(name => resolve(name, 'L')), 'skin'), makeFacet(facet.map(name => resolve(name, 'R')), 'skin'))
}
for (const [kind, names] of centerFacets) {
  facets.push(makeFacet(names.map(id), kind))
}
const threadKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
// An edge used by a single facet lies on the silhouette – or on the rim of an eye opening.
const edgeUse = new Map<string, number>
for (const facet of facets) {
  for (const [k, a] of facet.stars.entries()) {
    const key = threadKey(a, facet.stars[(k + 1) % facet.stars.length])
    edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1)
  }
}
const eyeRing = new Set<string>
for (const side of ['L', 'R'] as const) {
  const ring = ['eyeInner', 'eyeTop', 'eyeOuter', 'eyeBottom'].map(name => id(`${name}${side}`))
  for (const [k, a] of ring.entries()) {
    eyeRing.add(threadKey(a, ring[(k + 1) % ring.length]))
  }
}
const threadKeys = new Set<string>
const threads: Array<Thread> = []
for (const facet of facets) {
  for (const [k, a] of facet.stars.entries()) {
    const b = facet.stars[(k + 1) % facet.stars.length]
    const key = threadKey(a, b)
    if (threadKeys.has(key)) {
      continue
    }
    threadKeys.add(key)
    const rank: ThreadRank = eyeRing.has(key) ? 'eye' : (edgeUse.get(key) === 1 ? 'outline' : 'inner')
    threads.push({
      a,
      b,
      rank,
    })
  }
}
for (const key of eyeRing) {
  if (!threadKeys.has(key)) {
    throw new Error('Every eye rim thread must border a facet.')
  }
}
// Length-weighted graph distance from the nose tip (Dijkstra; the graph is tiny).
{ const distance = stars.map(() => Infinity)
  distance[id('noseTip')] = 0
  const pending = new Set(stars.keys())
  while (pending.size) {
    let best = -1
    for (const k of pending) {
      if (best < 0 || distance[k] < distance[best]) {
        best = k
      }
    }
    pending.delete(best)
    for (const thread of threads) {
      const other = thread.a === best ? thread.b : (thread.b === best ? thread.a : -1)
      if (other < 0) {
        continue
      }
      const [ax, ay] = stars[best].point
      const [bx, by] = stars[other].point
      distance[other] = Math.min(distance[other], distance[best] + Math.hypot(ax - bx, ay - by))
    }
  }
  const maxDistance = Math.max(...distance)
  if (!Number.isFinite(maxDistance)) {
    throw new TypeError('The cat constellation must be connected.')
  }
  for (const [k, star] of stars.entries()) {
    star.reach = distance[k] / maxDistance
  } }
for (const thread of threads) {
  if (stars[thread.a].reach > stars[thread.b].reach) {
    [thread.a, thread.b] = [thread.b, thread.a]
  }
}
const leftWhiskers: Array<Whisker> = [
  {
    root: [-0.145, -0.168],
    tip: [-0.475, -0.09],
    bend: 0.022,
  },
  {
    root: [-0.15, -0.185],
    tip: [-0.485, -0.19],
    bend: 0.02,
  },
  {
    root: [-0.145, -0.2],
    tip: [-0.455, -0.285],
    bend: 0.016,
  },
]
const whiskers: Array<Whisker> = [...leftWhiskers, ...leftWhiskers.map(({root, tip, bend}): Whisker => ({
  root: [-root[0], root[1]],
  tip: [-tip[0], tip[1]],
  bend,
}))]
/** eye opening, as star names of the left eye; the right eye mirrors it */
const eye = {
  inner: 'eyeInnerL',
  outer: 'eyeOuterL',
  top: 'eyeTopL',
  bottom: 'eyeBottomL',
}
/** vertical shift that centers the head in its cell */
const offsetY = -0.06
const catModel = {
  eye,
  facets,
  id,
  offsetY,
  stars,
  threads,
  whiskers,
}

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

type CatPose = {
/** 0 at gallery distance – 1 far away; simplifies the cat to its outline, stars and eyes */
  farness: Float
/** pixel footprint in cell units */
  footprint: Float
/** half extents of the cell in physical cell units */
  halfExtent: Vec2
/** 0 far away – 1 close enough to touch */
  intimacy: Float
/** fragment position in cell coordinates, centered, y toward the ears */
  local: Vec2
/** 0 far away – 1 close; brings out the inner threads */
  nearness: Float
/** reveal front, in normalized graph reach from the nose; above 1 the cat is complete */
  reveal: Float
/** per-cat random values in [0, 1) */
  seed: Node<'vec3'>
/** rotation of this cat within its cell, in radians */
  turn: Float
/** viewer direction projected onto the cell plane */
  viewInCell: Vec2
}

const vec = (point: Point) => vec2(point[0], point[1])
const rotate = (point: Vec2, angle: Float) => {
  const c = cos(angle)
  const s = sin(angle)
  return vec2(point.x.mul(c).sub(point.y.mul(s)), point.x.mul(s).add(point.y.mul(c)))
}
/** a short bump in [0, 1] that fires once per period at a random offset */
const twitch = (rate: number, offset: Node<'float'> | number, duty: number) => {
  const phase = time.mul(rate).add(offset).fract()
  return phase.div(duty).clamp().mul(Math.PI).sin()
}
/** a blink: the lids snap shut, hold for a beat, then open slowly */
const blink = (rate: number, offset: Node<'float'>, duty: number) => {
  const phase = time.mul(rate).add(offset).fract().div(duty)
  return smoothstep(0, 0.22, phase).mul(smoothstep(1, 0.4, phase))
}

type Vec3 = Node<'vec3'>

/** Line coverage for a half-width in cell units; sub-pixel lines keep their energy instead of aliasing. */
function lineCoverage(distance: Float, halfWidth: Float | number, footprint: Float) {
  const w = typeof halfWidth === 'number' ? float(halfWidth) : halfWidth
  const half = max(w, footprint.mul(0.5))
  return smoothstep(half.add(footprint.mul(0.5)), half.sub(footprint.mul(0.5)), distance).mul(w.div(half))
}
/** Evaluates one cat constellation at the fragment. Everything lives in cell coordinates, so the cat never crosses into a neighboring cell and needs no neighbor search. */
function catConstellation({local, footprint, halfExtent, seed, turn, nearness, farness, reveal, viewInCell: viewInGrid, intimacy}: CatPose) {
// --- whole-head motion is applied to the fragment instead of to 33 stars ---
  const breathe = sin(time.mul(1.55).add(seed.z.mul(TAU))).mul(0.018).add(1)
  const curiousSide = select(seed.y.greaterThan(0.5), float(1), float(-1))
  const tilt = sin(time.mul(0.37).add(seed.x.mul(TAU))).mul(0.07).add(sin(time.mul(0.93).add(seed.z.mul(17))).mul(0.025))
    .add(intimacy.mul(curiousSide).mul(sin(time.mul(0.45).add(seed.z.mul(9))).mul(0.35).add(0.65)).mul(0.13))
// Each cat has its own size, seat and angle, so the rows never read as a stamped grid.
// The head reaches 0.571 model units from its center; size and seat keep it inside the cell,
// with a margin for the ear flicks and whisker sway.
  const room = halfExtent.sub(0.045)
  const size = seed.z.mul(0.16).add(0.7).min(room.x.min(room.y).div(0.575))
  const freedom = room.sub(size.mul(0.575)).max(0)
  const seat = vec2(seed.y.sub(0.5), seed.x.sub(0.5)).mul(freedom).mul(2)
  const headScale = breathe.mul(size)
// Like constellations on a sky chart, cats lie at any angle.
  const orientation = turn
// The head is posed by moving the fragment into model space, instead of moving 33 stars.
  const upright = rotate(local.sub(seat), orientation.negate())
  const viewInCell = rotate(viewInGrid, orientation.negate())
// Tilting about the bounding center never pushes the head out of its cell.
  const pivot = vec2(0, -catModel.offsetY)
  const p = rotate(upright.div(headScale).sub(vec2(0, catModel.offsetY)).sub(pivot), tilt.negate()).add(pivot)
  const px = footprint.div(headScale)
// --- eyelids: quick blinks, and a slow “I trust you” blink when the visitor is close ---
  const quickBlink = blink(0.26, seed.z.mul(5.3), 0.075)
  const slowBlink = sin(time.mul(0.45).add(seed.x.mul(11))).mul(0.5).add(0.5).pow(14).mul(intimacy).mul(0.6)
  const awake = smoothstep(0.9, 1.2, reveal)
  const lidClosure = max(max(quickBlink, slowBlink), awake.oneMinus()).clamp(0, 0.97)
// --- ears: independent flicks plus a slow swivel toward the visitor ---
  const swivel = viewInCell.x.clamp(-1, 1).mul(-0.2)
// A flick is a sharp impulse that rings out like a damped spring.
  const earFlick = (side: -1 | 1) => {
    const phase = time.mul(0.27).add(seed.y.mul(3.7)).add(side * 0.43).fract().div(0.13)
    return exp(phase.mul(-3.2)).mul(phase.mul(Math.PI * 3).sin()).mul(select(phase.lessThan(1), float(1), float(0)))
  }
  const earAngle = (side: -1 | 1) => earFlick(side).mul(-side * 0.5).add(swivel)
  const earAngles = {
    '-1': earAngle(-1),
    1: earAngle(1),
  }
  const eyeInnerL = stars[catModel.id(eye.inner)].point
  const eyeOuterL = stars[catModel.id(eye.outer)].point
  const eyeCenterL: Point = [(eyeInnerL[0] + eyeOuterL[0]) * 0.5, (eyeInnerL[1] + eyeOuterL[1]) * 0.5]
  const eyeAxisLength = Math.hypot(eyeOuterL[0] - eyeInnerL[0], eyeOuterL[1] - eyeInnerL[1])
  const eyeAxisL: Point = [(eyeOuterL[0] - eyeInnerL[0]) / eyeAxisLength, (eyeOuterL[1] - eyeInnerL[1]) / eyeAxisLength]
  const positions: Array<Vec2> = stars.map(star => {
    if (star.ear) {
      const side = star.ear
      const outer = stars[catModel.id(side < 0 ? 'earOuterL' : 'earOuterR')].point
      const inner = stars[catModel.id(side < 0 ? 'earInnerL' : 'earInnerR')].point
      const earPivot: Point = [(outer[0] + inner[0]) * 0.5, (outer[1] + inner[1]) * 0.5]
      return rotate(vec2(star.point[0] - earPivot[0], star.point[1] - earPivot[1]), earAngles[side]).add(vec(earPivot))
    }
    if (star.lid) { // Close toward the eye axis of the matching eye.
      const mirror = star.point[0] < 0 ? 1 : -1
      const center: Point = [eyeCenterL[0] * mirror, eyeCenterL[1]]
      const axis: Point = [eyeAxisL[0] * mirror, eyeAxisL[1]]
      const offset = (star.point[0] - center[0]) * axis[0] + (star.point[1] - center[1]) * axis[1]
      const closed: Point = [center[0] + axis[0] * offset, center[1] + axis[1] * offset]
      return mix(vec(star.point), vec(closed), lidClosure.mul(0.85))
    }
    return vec(star.point)
  })
// --- stars: find the nearest star cheaply, then shade only that one ---
// A sequential search with a mutable variable: chained selects would grow exponentially.
  const nearestStarSearch = Fn(() => {
    const best = vec4(1e3, 0, 0, 0).toVar()
    for (const [starId, star] of stars.entries()) {
      const distance = p.sub(positions[starId]).length()
      If(distance.lessThan(best.x), () => {
        best.assign(vec4(distance, star.magnitude, star.reach, starId))
      })
    }
    return best
  })().toVar()
  const nearestStar = float(nearestStarSearch.x)
  const starMagnitude = float(nearestStarSearch.y)
  const starReach = float(nearestStarSearch.z)
  const starIndex = float(nearestStarSearch.w)
  const starHash = seed.x.mul(17.3).add(starIndex.mul(0.618034)).fract()
  const twinkle = sin(time.mul(starHash.mul(2.6).add(1.4)).add(starHash.mul(40))).mul(0.22).add(0.88)
  const starLit = smoothstep(starReach.sub(0.02), starReach.add(0.04), reveal)
// A white-hot flare as the drawing front reaches the star.
  const starFlare = exp(reveal.sub(starReach).div(0.045).pow2().negate()).mul(select(reveal.lessThan(1.2), float(1), float(0)))
  const starCore = lineCoverage(nearestStar, starMagnitude.pow2().mul(0.0085).add(0.0032), px)
  const starHalo = exp(nearestStar.div(starMagnitude.mul(0.009).add(0.005)).negate()).mul(starMagnitude)
  const faint = select(starMagnitude.lessThan(0.5), float(1), float(0))
  const starBrightness = starLit.mul(0.9).add(0.1).mul(twinkle).mul(starMagnitude.pow(1.5).mul(0.75).add(0.25)).mul(farness.mul(faint).mul(-0.7).add(1))
  let starLight: Float = starCore.mul(1.8).add(starHalo.mul(0.3)).mul(starBrightness)
  let starHeat: Float = starFlare.mul(starCore.add(starHalo.mul(0.5)))
// Only the alpha stars carry six-pointed diffraction spikes, like a segmented telescope mirror.
// They lie far apart, so only the nearest one needs to be drawn.
  const alphaStars = stars.entries().filter(([, star]) => star.magnitude >= 0.65).toArray()
  const alphaSearch = Fn(() => {
    const best = vec4(1e3, 0, 0, 0).toVar()
    for (const [starId, star] of alphaStars) {
      const offset = p.sub(positions[starId])
      If(offset.length().lessThan(best.x), () => {
        best.assign(vec4(offset.length(), offset.x, offset.y, starId + star.magnitude * 0.5))
      })
    }
    return best
  })().toVar()
  const alphaOffset = vec2(alphaSearch.y, alphaSearch.z)
  const alphaIndex = float(alphaSearch.w).floor()
  const alphaMagnitude = float(alphaSearch.w).fract().mul(2)
  let alphaReach: Float = float(0)
  for (const [starId, star] of alphaStars) {
    alphaReach = select(alphaIndex.equal(starId), float(star.reach), alphaReach)
  }
  const alphaHash = seed.x.mul(17.3).add(alphaIndex.mul(0.618034)).fract()
  const glimmer = sin(time.mul(alphaHash.mul(2.6).add(1.4)).add(alphaHash.mul(40))).mul(0.22).add(0.88)
  const alphaFlare = exp(reveal.sub(alphaReach).div(0.045).pow2().negate()).mul(select(reveal.lessThan(1.2), float(1), float(0)))
  const alphaLit = smoothstep(alphaReach.sub(0.02), alphaReach.add(0.04), reveal)
  const spikeLength = alphaFlare.mul(1.2).add(1).mul(alphaMagnitude.mul(0.05).add(0.035))
  let spikes: Float = float(0)
  for (const angle of [Math.PI / 2, Math.PI / 2 + Math.PI / 3, Math.PI / 2 - Math.PI / 3]) {
    const direction = vec2(Math.cos(angle), Math.sin(angle))
    const alongSpike = alphaOffset.dot(direction).abs()
    const across = alphaOffset.x.mul(direction.y).sub(alphaOffset.y.mul(direction.x)).abs()
    spikes = spikes.add(lineCoverage(across, 0.0011, px).mul(alongSpike.div(spikeLength).oneMinus().clamp().pow(3)))
  }
  starLight = starLight.add(spikes.mul(0.8).mul(alphaLit.mul(0.9).add(0.1)).mul(glimmer).mul(alphaMagnitude.pow(1.5).mul(0.75).add(0.25)))
  starHeat = max(starHeat, alphaFlare.mul(spikes.mul(0.6)))
// --- threads: a cheap pass per thread tracks the nearest one; only that one is shaded ---
  const sides = new Map<string, Float>
  const rankOf = {
    outline: 0,
    eye: 1,
    inner: 2,
  }
  for (const thread of threads) {
    const a = positions[thread.a]
    const ba = positions[thread.b].sub(a)
    const pa = p.sub(a)
// Anti-aliased “left of this thread” coverage, shared by the facets on both sides.
    sides.set(`${thread.a}:${thread.b}`, smoothstep(px.negate(), px, ba.x.mul(pa.y).sub(ba.y.mul(pa.x)).div(ba.length())))
  }
// The nearest thread’s endpoint reaches and rank travel packed into one exact integer (< 2²⁴).
  const pack = (thread: typeof threads[number]) => Math.round(stars[thread.a].reach * 1023) + Math.round(stars[thread.b].reach * 1023) * 1024 + rankOf[thread.rank] * 1_048_576
  const threadSearch = Fn(() => {
    const best = vec4(1e3, 0, 1, 0).toVar()
    for (const thread of threads) {
      const a = positions[thread.a]
      const ba = positions[thread.b].sub(a)
      const pa = p.sub(a)
      const lengthSquared = ba.dot(ba)
      const h = pa.dot(ba).div(lengthSquared).clamp()
      const distance = pa.sub(ba.mul(h)).length()
      If(distance.lessThan(best.x), () => {
        best.assign(vec4(distance, h, lengthSquared.sqrt(), pack(thread)))
      })
    }
    return best
  })().toVar()
  const nearest = float(threadSearch.x)
  const along = float(threadSearch.y)
  const span = float(threadSearch.z)
  const code = float(threadSearch.w)
  const rankIndex = code.div(1_048_576).floor()
  const reachTo = code.sub(rankIndex.mul(1_048_576)).div(1024).floor().div(1023)
  const reachFrom = code.mod(1024).div(1023)
  const isOutline = select(rankIndex.lessThan(0.5), float(1), float(0))
  const isEyeRing = select(rankIndex.sub(1).abs().lessThan(0.5), float(1), float(0))
  const isInner = select(rankIndex.greaterThan(1.5), float(1), float(0))
// From afar only the silhouette, the eyes and the brightest stars remain, kept at least 0.6 px wide.
  const threadWidth = isOutline.mul(max(float(0.0046), px.mul(farness.mul(0.6))))
    .add(isEyeRing.mul(0.0028))
    .add(isInner.mul(0.0022))
  const threadWeight = isInner.mul(nearness.mul(0.3).add(0.28).mul(farness.mul(-0.75).add(1)).sub(1)).add(1)
  const glowWeight = isOutline.add(isEyeRing.mul(0.5)).add(isInner.mul(0.25))
  const reach = mix(reachFrom, reachTo, along)
  const drawn = smoothstep(reach, reach.add(0.035), reveal)
  const front = exp(reveal.sub(reach).div(0.028).pow2().negate()).mul(select(reveal.lessThan(1.1), float(1), float(0)))
  const solid = lineCoverage(nearest, threadWidth, px)
// Resolved from up close, each thread breaks into a chain of drifting beads.
  const beadSpacing = 0.013
  const beadWeight = smoothstep(beadSpacing * 0.42, beadSpacing * 0.16, px)
  const beadAlong = along.mul(span).div(beadSpacing).sub(time.mul(0.9)).fract().sub(0.5).mul(beadSpacing)
  const bead = lineCoverage(vec2(beadAlong, nearest).length(), 0.0036, px)
  const endGap = min(along, along.oneMinus()).mul(span)
  const beadZone = smoothstep(0.012, 0.03, endGap)
  const core = mix(solid, bead.mul(1.25).add(solid.mul(0.18)), beadWeight.mul(beadZone)).mul(drawn)
// Purring: pulses of light run outward from the nose along every thread.
  const flowPhase = time.mul(0.55).add(seed.y)
  const pulse = reach.mul(4.2).sub(flowPhase).fract()
  const flow = smoothstep(0.78, 0.97, pulse).mul(smoothstep(1, 0.97, pulse))
  const eyeRingCore = core.mul(isEyeRing)
  const threadCore = core.mul(isEyeRing.oneMinus()).mul(threadWeight)
  const threadGlow = exp(nearest.div(0.0075).negate()).mul(drawn).mul(glowWeight)
  const threadFlow = flow.mul(core.add(exp(nearest.div(0.006).negate()).mul(0.5).mul(drawn)))
  const threadSpark = front.mul(core.mul(2).add(exp(nearest.div(0.008).negate()).mul(0.6)))
  const leftOf = (a: number, b: number) => {
    const forward = sides.get(`${a}:${b}`)
    if (forward) {
      return forward
    }
    const backward = sides.get(`${b}:${a}`)
    if (!backward) {
      throw new Error(`No thread between stars ${a} and ${b}`)
    }
    return backward.oneMinus()
  }
// --- facets: point-in-polygon from the shared thread sides ---
  let facetMask: Float = float(0)
  let noseMask: Float = float(0)
  let tilt2: Vec2 = vec2(0, 0)
  let facetShade: Float = float(0)
  for (const [facetIndex, facet] of facets.entries()) {
    let inside: Float = float(1)
// Left of every counter-clockwise edge.
    for (const [k, a] of facet.stars.entries()) {
      inside = inside.mul(leftOf(a, facet.stars[(k + 1) % facet.stars.length]))
    }
    const reachMax = Math.max(...facet.stars.map(star => stars[star].reach))
    inside = inside.mul(smoothstep(reachMax, reachMax + 0.15, reveal))
    if (facet.kind === 'nose') {
      noseMask = noseMask.add(inside)
      continue
    }
    facetMask = facetMask.add(inside)
// Facets lean outward like a cut gem dome, plus a little per-facet character.
    const [cx, cy] = facet.centroid
    const jitter = facetIndex * 0.754877 % 1 - 0.5
    tilt2 = tilt2.add(vec2(cx * 1.35 + jitter * 0.12, (cy + 0.03) * 1.2 - jitter * 0.08).mul(inside))
    facetShade = facetShade.add(inside.mul(facetIndex * 0.381966 % 1 * 0.6 + 0.4))
  }
  const noseShade = p.sub(positions[catModel.id('noseTip')]).length().div(0.06).clamp()
// --- eyes: evaluated once in a mirrored frame ---
  const mirror = select(p.x.greaterThan(0), float(-1), float(1))
  const eyeP = vec2(p.x.abs().negate(), p.y)
  const eyeTopL = positions[catModel.id(eye.top)]
  const eyeBottomL = positions[catModel.id(eye.bottom)]
  const center = vec(eyeCenterL)
  const axisX = vec(eyeAxisL)
  const axisY = vec2(-eyeAxisL[1], eyeAxisL[0])
  const e = vec2(eyeP.sub(center).dot(axisX), eyeP.sub(center).dot(axisY))
  const halfWidth = eyeAxisLength * 0.5 * 0.9
  const openHeight = eyeTopL.sub(eyeBottomL).length().mul(0.5 * 0.56)
  const halfHeight = openHeight.max(0.0005)
  const lens = e.x.div(halfWidth).pow2().oneMinus().max(0).pow(0.72)
  const lid = e.y.abs().sub(halfHeight.mul(lens))
  const eyeMask = smoothstep(px, px.negate(), lid).mul(smoothstep(halfWidth, halfWidth - 0.004, e.x.abs()))
// The pupils look at the visitor; they dilate as the visitor approaches.
// Now and then a cat glances elsewhere for a moment, then its gaze returns to the visitor.
  const glanceClock = time.mul(0.23).add(seed.y.mul(9))
  const glanceSeed = sin(vec2(glanceClock.floor().mul(12.9898).add(seed.x.mul(78.2)), glanceClock.floor().mul(4.1414).add(seed.z.mul(31.4)))).mul(43_758.5453).fract().sub(0.5)
  const glancing = smoothstep(0.55, 0.62, glanceClock.fract()).mul(smoothstep(0.92, 0.85, glanceClock.fract()))
  const gaze = mix(viewInCell, glanceSeed.mul(1.6), glancing.mul(0.85))
  const look = vec2(gaze.x.mul(mirror), gaze.y).clamp(-1, 1)
  const lookEye = vec2(look.dot(axisX), look.dot(axisY))
  const pupilCenter = vec2(lookEye.x.mul(halfWidth * 0.42), lookEye.y.mul(0.006))
  const dilation = mix(float(0.09), float(0.24), intimacy).add(sin(time.mul(0.8).add(seed.x.mul(7))).mul(0.025))
  const pupilOffset = e.sub(pupilCenter)
// A feline slit: widest in the middle, pinched to needle points just inside the lids.
  const pupilHalfHeight = openHeight.max(0.004).mul(0.9).sub(pupilCenter.y.abs())
  const pinch = pupilOffset.y.div(pupilHalfHeight).pow2().oneMinus().max(0)
  const pupilDistance = pupilOffset.x.abs().sub(dilation.mul(halfWidth).mul(pinch))
  const pupil = smoothstep(px.mul(0.7), px.mul(-0.7), pupilDistance)
  const irisRadius = vec2(e.x.div(halfWidth), e.y.div(0.034)).length()
// Iris fibers radiate from the pupil; resolved only from up close.
  const irisOffset = e.sub(pupilCenter)
  const fiberAngle = atan(irisOffset.y, irisOffset.x.mul(0.7))
  const fiberRadius = irisOffset.length()
  const fibers = fiberAngle.mul(37).add(fiberRadius.mul(90)).add(seed.z.mul(40)).sin()
    .mul(fiberAngle.mul(11).sub(fiberRadius.mul(60)).add(seed.x.mul(20)).sin().mul(0.5).add(0.5))
  const fiberDetail = smoothstep(0.0035, 0.0012, px).mul(fibers)
// The iris darkens toward the lids, like a limbal ring seen through the almond opening.
  const limbal = smoothstep(halfHeight.mul(-0.55).sub(px), px, lid)
// A glint on the curved cornea slides against the look direction as the visitor moves.
  const catchlightOffset = e.sub(vec2(halfWidth * -0.36, 0.014)).add(lookEye.mul(vec2(halfWidth * 0.3, 0.012)))
  const catchlight = lineCoverage(catchlightOffset.length(), 0.0042, px).mul(eyeMask).mul(lidClosure.oneMinus().pow(2))
  const eyeRim = exp(lid.max(0).div(0.009).negate()).mul(smoothstep(px.negate(), px, lid)).mul(smoothstep(halfWidth + 0.03, halfWidth - 0.02, e.x.abs())).mul(awake)
// --- whiskers: gently bowed, swaying, brighter at the root ---
  let whiskerLight: Float = float(0)
  for (const [whiskerIndex, whisker] of whiskers.entries()) {
    const root = vec(whisker.root)
    const tipSide = whisker.tip[0] < 0 ? -1 : 1
    const sway = sin(time.mul(1.3).add(seed.z.mul(6)).add(whiskerIndex * 0.9)).mul(0.012)
      .add(twitch(0.13, seed.x.mul(4).add(tipSide * 0.2), 0.05).mul(0.03))
    const tip = vec(whisker.tip).add(vec2(0, sway))
    const axis = tip.sub(root)
    const whiskerLength = axis.length()
    const direction = axis.div(whiskerLength)
    const offset = p.sub(root)
    const alongWhisker = offset.dot(direction)
    const t = alongWhisker.div(whiskerLength)
    const clamped = t.clamp()
    const across = direction.x.mul(offset.y).sub(direction.y.mul(offset.x)).mul(tipSide)
    const sag = clamped.mul(clamped.oneMinus()).mul(4 * whisker.bend)
// A chain of shrinking dots that ends in a tiny star, drifting outward like a slow purr.
    const spacing = 0.021
    const beadPhase = clamped.mul(whiskerLength).div(spacing).sub(time.mul(0.35)).add(whiskerIndex * 0.37)
    const whiskerBeadAlong = beadPhase.fract().sub(0.5).mul(spacing)
    const outside = t.sub(clamped).mul(whiskerLength)
    const across2 = across.add(sag)
    const dotRadius = clamped.mul(-0.55).add(1).mul(0.0036)
    const dots = lineCoverage(vec2(whiskerBeadAlong.add(outside), across2).length(), dotRadius, px)
    const thread = lineCoverage(vec2(outside, across2).length(), 0.0009, px).mul(0.35)
    const tipStar = lineCoverage(p.sub(tip).length(), 0.004, px).mul(1.4)
    whiskerLight = whiskerLight.add(max(dots, thread).mul(clamped.mul(0.6).oneMinus())).add(tipStar)
  }
  whiskerLight = whiskerLight.mul(smoothstep(0.9, 1.08, reveal)).mul(farness.mul(-0.6).add(1))
  return {
    awake,
    catchlight,
    fiberDetail,
    limbal,
    eyeMask: eyeMask.mul(awake.mul(0.85).add(0.15)),
    eyeRim,
    eyeRingCore,
    facetMask: facetMask.clamp(),
    facetShade,
    facetTilt: tilt2,
    irisRadius,
    lidClosure,
    noseMask: noseMask.clamp(),
    noseShade,
    pupil,
    starHeat,
    starLight,
    threadCore,
    threadFlow,
    threadGlow,
    threadSpark,
    whiskerLight,
  }
}
/** One layer of pinpoint stars on a jittered 3D lattice. Unresolved stars fade toward an even haze instead of sparkling as aliasing. */
function dustLayer(point: Vec3, density: number, threshold: Float, seed: number) {
  const q = point.mul(density)
  const cell = q.floor()
  const random = cellNoiseVec3(cell.add(seed))
  const center = random.mul(0.6).add(0.2)
  const distance = q.fract().sub(center).length()
  const footprint = q.fwidth().length().max(0.0001)
  const starRadius = footprint.mul(0.75).max(0.035)
  const energy = float(0.035).div(starRadius).pow2()
  const core = smoothstep(starRadius, float(0), distance).pow(1.6)
  const gate = smoothstep(threshold, threshold.add(0.02), mx_cell_noise_float(cell.add(seed + 13.1)))
  const twinkle = sin(time.mul(random.y.mul(3).add(0.8)).add(random.z.mul(60))).mul(0.4).add(0.7)
  const tint = mix(color('#ffc9a0'), color('#a9c8ff'), random.x)
  const resolved = footprint.smoothstep(0.5, 1.4).oneMinus()
  return tint.mul(core.mul(gate).mul(twinkle).mul(energy).mul(resolved))
}
/** Deep space beneath a thick glass lacquer. Every layer is sampled at its own depth along the refracted view ray, so the sky slides against the constellations as the visitor moves; a winding Milky Way with dark dust lanes gives the knot a large-scale composition. */
function deepSky(position: Vec3, view: Vec3, normal: Vec3) {
  const cosine = normal.dot(view).max(0.22)
// Tangential view component over cos θ: the lateral shift of a point at unit depth.
  const slide = view.sub(normal.mul(normal.dot(view))).div(cosine)
  const below = (depth: number) => position.sub(slide.mul(depth)).sub(normal.mul(depth))
  const drift = vec3(time.mul(0.004), time.mul(-0.003), time.mul(0.002))
// The galactic band: a winding ribbon where a low-frequency field crosses zero.
  const galaxyPoint = below(0.05).add(drift)
  const bandField = mx_noise_float(galaxyPoint.mul(1.25).add(vec3(1.3, 7.1, -2.4))).add(mx_noise_float(galaxyPoint.mul(3.1)).mul(0.22))
  const band = exp(bandField.div(0.2).pow2().negate())
  const lanes = smoothstep(0.26, 0.02, mx_fractal_noise_float(galaxyPoint.mul(3.4).add(bandField.mul(2)), 2, 2, 0.45).abs()).mul(band)
  const nebulaPoint = below(0.09).add(drift)
  const veil = mx_fractal_noise_float(nebulaPoint.mul(2.6), 3, 2.1, 0.55).mul(0.5).add(0.5)
  const filament = mx_fractal_noise_float(nebulaPoint.mul(7.5).add(veil.mul(1.4)), 2, 2.2, 0.5).mul(0.5).add(0.5)
  const hue = mx_noise_float(nebulaPoint.mul(1.3).add(vec3(3.1, -2.2, 0.7))).mul(0.5).add(0.5)
  const nebulaTint = mix(mix(color('#22115e'), color('#6a1668'), smoothstep(0.35, 0.7, hue)), color('#0e5a6e'), smoothstep(0.55, 0.85, filament).mul(0.6))
  const density = smoothstep(0.38, 0.85, veil).mul(filament.mul(0.8).add(0.4))
  const galacticGlow = mix(color('#2a1f5a'), color('#8f7fc0'), band.pow(4).mul(0.5)).mul(band.pow(1.5).mul(0.13))
  const nebula = nebulaTint.mul(density.mul(0.32).add(0.05)).add(galacticGlow).mul(lanes.mul(0.9).oneMinus())
  const dustThreshold = (base: number) => band.mul(-0.3).add(base)
  const dust = dustLayer(below(0.02), 95, dustThreshold(0.74), 1.7)
    .add(dustLayer(below(0.065), 70, dustThreshold(0.78), 7.9).mul(0.6))
    .add(dustLayer(below(0.14), 48, dustThreshold(0.8), 3.3).mul(0.4).mul(lanes.mul(0.9).oneMinus()))
  return {
    band,
    density,
    dust,
    nebula,
  }
}
/** Occasional meteors racing along the tube, one lane per cell row. `along` is the continuous along-row coordinate in cells and `columns` its period. */
function meteors(along: Float, columns: Float, row: Float, local: Node<'vec2'>) {
  const speed = 7
  const period = 6
  const phase = time.div(period).add(row.mul(0.37))
  const pass = phase.floor()
  const passSeed = cellNoiseVec3(vec3(pass, row, 3.3))
  const start = passSeed.x.mul(columns).add(phase.fract().mul(period * speed))
  const behind = along.sub(start).div(columns).add(0.5).fract().sub(0.5).mul(columns).negate()
  const lane = passSeed.y.mul(0.6).sub(0.3)
  const across = local.y.sub(lane.add(behind.mul(passSeed.z.sub(0.5).mul(0.03))))
// A tapering, fading tail behind a soft glowing head.
  const trail = behind.max(0)
  const width = exp(trail.div(2.5).negate()).mul(0.006).add(0.0015)
  const tail = smoothstep(-0.03, 0.03, behind).mul(exp(trail.div(1.4).negate()))
  const glow = exp(vec2(behind.mul(0.5), across).length().div(0.018).negate()).mul(1.4)
  const body = exp(across.div(width).pow2().negate()).mul(tail).add(glow)
  const active = smoothstep(0.5, 0.54, passSeed.x.mul(0.5).add(passSeed.z.mul(0.5)))
// Row borders are hard seams in local.y, so the streak must fade out before reaching them.
  const inRow = smoothstep(0.5, 0.4, local.y.abs())
  return body.mul(active).mul(inRow).mul(smoothstep(0, 0.06, phase.fract())).mul(smoothstep(0.55, 0.4, phase.fract()))
}
const rows = 4
let sharedChart: ReturnType<typeof createTubeChart> | undefined
/** The chart only depends on the knot geometry, so every instance shares one. */
const getChart = () => sharedChart ??= createTubeChart({rows})
/** pick one of several colors by a uniform random value */
function pick(value: Float, palette: Array<string>): Vec3 { // Hex colors are sRGB; Color converts them to the linear working space.
  const linear = palette.map(entry => {
    const {r, g, b} = new Color(entry)
    return vec3(r, g, b)
  })
  let result: Vec3 = linear[0]
  for (const [colorIndex, entry] of linear.entries()) {
    if (colorIndex > 0) {
      result = select(value.greaterThanEqual(colorIndex / palette.length), entry, result)
    }
  }
  return result
}

/** Felis Major: a sky chart of cats. Every cell of the knot holds a low-poly cat head drawn as a constellation over a lacquered window into deep space. Cats draw themselves outward from the nose in slow waves around the knot, open their eyes, purr light along their threads, blink, flick their ears, and follow the visitor with their pupils and ears. Facets are cut like a gem dome, so they flash as the visitor walks around; up close the threads resolve into beads. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
// Black lacquer: the dim studio fill falls toward black while the softboxes stay crisp.
    this.envNode = pmremTexture(environment).pow(2).mul(0.07)
    this.name = knotData.id
    const chart = getChart()
// The constellations float 7 mm deep inside the lacquer (the knot spans about 1.6 units).
    const cells = catCells(chart, {depth: 0.007})
    const seed = cellNoiseVec3(vec3(cells.column, cells.row, 41.3))
    const seed2 = cellNoiseVec3(vec3(cells.column, cells.row, -7.9))
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const viewLocal = cameraLocal.sub(positionGeometry).normalize()
    const facing = cells.normal.dot(positionViewDirection).abs().clamp()
    const distance = positionView.length()
    const intimacy = smoothstep(2.1, 0.75, distance)
    const nearness = smoothstep(4.2, 1.2, distance)
    const farness = smoothstep(2.6, 4.6, distance)
// Waves of creation circle the knot: two loose fronts, each cat noticeably out of step. A cat
// draws itself outward from the nose for two seconds, lives, then collapses back into its nose.
    const cycleSeconds = 10
    const alongKnot = cells.column.add(0.5).div(cells.columns)
    const cycle = time.div(cycleSeconds).sub(alongKnot.mul(2)).sub(cells.row.mul(0.11)).add(seed.y.mul(0.3)).fract()
    const build = cycle.div(0.2).clamp().mul(1.27).sub(0.07)
    const unravel = cycle.sub(0.86).div(0.14).clamp().pow(1.4)
    const wave = mix(build, float(-0.08), unravel.mul(1.02).clamp())
// Constellations only fully draw themselves where they are watched.
    const watched = smoothstep(0.03, 0.32, facing).mul(1.3)
// A few cats lie dormant – only their stars show – until a visitor comes close.
    const dormant = seed2.z.lessThan(0.14)
    const reveal = select(dormant, intimacy.smoothstep(0.35, 0.95).mul(1.25).sub(0.08), wave).min(watched)
    const turn = cellNoiseVec3(vec3(cells.column, cells.row, 113.7)).x.mul(TAU)
// Nothing may be clipped by a cell border: all cat light fades out just before it.
    const cellEdge = smoothstep(0, 0.045, cells.edgeDistance)
    const cat = catConstellation({
      footprint: cells.footprint,
      halfExtent: cells.halfExtent,
      farness,
      intimacy,
      nearness,
      turn,
      local: cells.local,
      reveal,
      seed,
      viewInCell: cells.viewInCell,
    })
    const sky = deepSky(positionGeometry, viewLocal, normalGeometry.normalize())
    const meteor = meteors(cells.along, cells.columns, cells.row, cells.local)
// --- palette ---
    const threadTint = pick(seed2.x, ['#8fd8ff', '#8fd8ff', '#a6b8ff', '#c3a6ff', '#7ff0e0', '#ffd6a0'])
    const threadCore = mix(threadTint, color('#f4fbff'), 0.55)
    const eyeTint = pick(seed2.y, ['#ffb640', '#c8f25a', '#7fe8ff', '#ff8f4a', '#6ff0a8', '#ffd24a'])
    const eyeDeep = eyeTint.mul(color('#5a3a14').mul(0.9).add(0.1))
    const sparkTint = color('#fff3dc')
// --- emissive light ---
// Seen through thick glass at the limb, the constellations dim.
    const limb = smoothstep(0.02, 0.4, facing).mul(0.6).add(0.4)
    const presence = nearness.mul(0.35).add(0.65).mul(limb)
    const farBoost = smoothstep(2.4, 5, distance).mul(0.6).add(1)
    const threadLight = threadCore.mul(cat.threadCore.mul(1.15))
      .add(threadTint.mul(cat.threadGlow.mul(0.12).mul(farBoost)))
      .add(color('#dff6ff').mul(cat.threadFlow.mul(3)))
    const starGlow = mix(color('#fff1dc'), threadCore, 0.3).mul(cat.starLight.mul(1.7))
    const whiskerGlow = color('#e8f2ff').mul(cat.whiskerLight.mul(0.9))
    const sparks = sparkTint.mul(cat.threadSpark.mul(2.6).add(cat.starHeat.mul(2.2)))
// Bright near the pupil, a darker limbal ring at the rim, fibers between.
    const irisLight = mix(eyeTint.mul(1.5), eyeDeep.mul(0.6), smoothstep(0.15, 1.05, cat.irisRadius))
      .mul(cat.fiberDetail.mul(0.32).add(0.9))
      .mul(cat.limbal.mul(0.72).oneMinus())
    const eyes = irisLight.mul(cat.eyeMask).mul(cat.pupil.oneMinus())
      .add(color('#ffffff').mul(cat.catchlight.mul(1.8)))
      .add(eyeTint.mul(cat.eyeRim.mul(0.35)))
      .add(mix(eyeTint, color('#ffffff'), 0.3).mul(cat.eyeRingCore.mul(0.9)))
// A bevelled nose leather: pale on the bridge, deep rose at the tip.
    const nose = mix(color('#b8205a'), color('#ffa3c6'), cat.noseShade).mul(cat.noseMask.mul(1.6))
    const facetGlow = threadTint.mul(cat.facetMask.mul(cat.facetShade).mul(0.012))
    const shimmer = cat.facetMask.mul(cat.facetShade.mul(9).add(time.mul(1.7)).add(cells.local.y.mul(-14)).sin().mul(0.5).add(0.5).pow(12)).mul(0.08)
    const meteorLight = color('#e6f4ff').mul(meteor.mul(3.2))
// Far away the stardust would only glitter, so it recedes and leaves the cats to carry the view.
    const skyLight = sky.nebula.mul(0.5).add(sky.dust.mul(farness.mul(-0.75).add(1).mul(0.9))).mul(cat.facetMask.mul(0.45).oneMinus())
    const emissive = threadLight.add(starGlow).add(whiskerGlow).add(sparks).mul(presence).mul(cellEdge)
      .add(eyes)
      .add(nose)
      .add(facetGlow)
      .add(threadTint.mul(shimmer))
      .add(meteorLight)
      .add(skyLight)
    this.emissiveNode = emissive
// --- surface ---
    const lacquer = mix(color('#020309'), color('#0a0b1c'), sky.density.mul(0.8))
    const facetBody = mix(lacquer, threadTint.mul(0.1), cat.facetShade.mul(0.35).add(0.25))
    let albedo: Vec3 = mix(lacquer, facetBody, cat.facetMask)
    albedo = mix(albedo, color('#010102'), cat.eyeMask.mul(cat.pupil))
    albedo = mix(albedo, eyeDeep.mul(0.3), cat.eyeMask.mul(cat.pupil.oneMinus()))
    this.colorNode = albedo
    this.metalnessNode = cat.facetMask.mul(0.55)
    this.roughnessNode = mix(float(0.09), float(0.06), cat.facetMask).sub(cat.eyeMask.mul(0.03)).clamp(0.03, 1)
    this.specularIntensityNode = mix(float(0.15), float(0.75), cat.facetMask)
    this.iridescenceNode = cat.facetMask.mul(0.85)
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = cat.facetShade.mul(420).add(180)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.02
    const tilt = cat.facetTilt.mul(0.55)
    this.normalNode = cells.normal.add(cells.xAxis.mul(tilt.x)).add(cells.yAxis.mul(tilt.y)).normalize()
  }
}
