import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, Fn, mix, mx_cell_noise_float, mx_fractal_noise_float, normalLocal, positionGeometry, struct, tangentLocal, time, uv, vec2, vec3} from 'three/tsl'

import {wavelengthColor} from '../../candidates/space_bunny/lib/wavelength.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const offsets = [-1, 0, 1].flatMap(y => [-1, 0, 1].map(x => [x, y] as const))
const wrap = (cell: Node<'vec2'>, period: Node<'vec2'>) => cell.mod(period).add(period).mod(period)
/** A feature point inside one cell, always strictly interior, so the nearest cell can be recovered from its offset alone. The cell is wrapped to the period first, which makes the whole field genuinely periodic: the shard pattern closes on itself with no seam, exactly like panes of glass that were cut to fit the frame they were set into. */
const featurePoint = (cell: Node<'vec2'>, period: Node<'vec2'>, jitter: Node<'float'>) => {
  const id = wrap(cell, period)
  const seed = vec3(id.x, id.y, 0.5)
  return vec2(mx_cell_noise_float(seed), mx_cell_noise_float(seed.add(vec3(3.1, 7.7, 0)))).sub(0.5).mul(jitter).add(0.5)
}
const ShardResult = struct({
  border: 'float',
  cell: 'vec2',
  distance: 'float',
}, 'ShardResult')
const shardCore = Fn(([q, period, jitter]: [Node<'vec2'>, Node<'vec2'>, Node<'float'>]) => {
  const base = q.floor().toVar()
  const nearest = vec2(0).toVar()
  const nearestOffset = vec2(0).toVar()
  const nearestSq = float(1e9).toVar()
// First pass: which cell owns this point?
  for (const [x, y] of offsets) {
    const offset = vec2(x, y)
    const toFeature = base.add(offset).add(featurePoint(base.add(offset), period, jitter)).sub(q)
    const sq = toFeature.dot(toFeature)
    const closer = sq.lessThan(nearestSq)
    nearest.assign(closer.select(toFeature, nearest))
    nearestOffset.assign(closer.select(offset, nearestOffset))
    nearestSq.assign(closer.select(sq, nearestSq))
  }
// Second pass around the winner: the exact distance to the nearest cell wall, so that a ribbon drawn
// from `border` is an even, constant width however the cells happen to be cut.
  const border = float(1e9).toVar()
  for (const [x, y] of offsets) {
    const offset = nearestOffset.add(vec2(x, y))
    const toFeature = base.add(offset).add(featurePoint(base.add(offset), period, jitter)).sub(q)
    const between = toFeature.sub(nearest)
    const separation = between.dot(between)
    const direction = between.div(separation.max(1e-12).sqrt())
    const distance = nearest.add(toFeature).mul(0.5).dot(direction)
    const closer = separation.greaterThan(1e-6).and(distance.lessThan(border))
    border.assign(closer.select(distance, border))
  }
  return ShardResult(border, wrap(base.add(nearestOffset), period), nearest.length())
})
type Shards = {
  border: Node<'float'>
  cell: Node<'vec2'>
  distance: Node<'float'>
}
/** Two-pass 2D Voronoi: the owning cell, its feature distance, and an exact distance to its border. */
function shards(q: Node<'vec2'>, period: Node<'vec2'>, jitter = 0.86): Shards {
  if (!(jitter > 0 && jitter < 1)) {
    throw new RangeError('Shard jitter must be in (0, 1).')
  }
  const result = (shardCore(q, period, float(jitter)) as unknown as {toVar: () => {get: <Type extends 'float' | 'vec2'>(name: string) => Node<Type>}}).toVar()
  return {
    border: result.get<'float'>('border'),
    cell: result.get<'vec2'>('cell'),
    distance: result.get<'float'>('distance'),
  }
}
const T = tangentLocal
const B = bitangentLocal as unknown as Node<'vec3'>
const panelCount = vec2(26, 4)
type Window = {
  border: Node<'float'>
  cell: Node<'vec2'>
  distance: Node<'float'>
}
/** The leaded skeleton. `period` makes the field genuinely periodic along the tube, so the came closes on itself with no seam, and `border` is an exact distance to the nearest bisector, so the lead ribbon keeps an even width however the panes are cut. A shifted copy of the same network is the inner layer: the same came, seen through the thickness of the glass, which is what actually slides against the surface when a visitor walks past. */
const leaded = (tube: Node<'vec2'>, period: Node<'vec2'>, shift: Node<'vec2'>): Window => {
  const field = shards(tube.mul(period).add(shift), period)
  return {
    border: field.border,
    cell: field.cell,
    distance: field.distance,
  }
}
/** An even ribbon on the zero set, with distant-detail suppression once it drops below a pixel. */
const ribbon = (border: Node<'float'>, halfWidth: Node<'float'> | number) => {
  const width = typeof halfWidth === 'number' ? float(halfWidth) : halfWidth
  const foot = border.fwidth().max(1e-5)
  return border.abs().smoothstep(width, foot.mul(1.3).add(width)).oneMinus().mul(foot.smoothstep(width.mul(2.2), width.mul(9)).oneMinus())
}
/** Vitrail. The whole knot is one leaded window: a periodic network of came dividing it into panes, each filled with a different colour of antique glass. Light entering a pane is attenuated by the length of glass it crosses, so every pane deepens as the surface turns away, while the shadow the lead throws on the inner layer slides against it. A single slow sun walks the window, and where it lands the colours come up like a choir. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, grazing, near, intimate, rim} = viewerFrame()
    const tube = uv()
    const ray = vec2(view.dot(T), view.dot(B))
    const pane = leaded(tube, panelCount, vec2(0))
    const inner = leaded(tube, panelCount, ray.mul(0.5))
    const came = ribbon(pane.border, 0.075)
    const cameCore = ribbon(pane.border, 0.03)
    const innerCame = ribbon(inner.border, 0.07).mul(0.6)
    const identity = cellNoiseVec3(vec3(pane.cell.x.add(0.5), pane.cell.y.add(0.5), 4.7))
// Every pane is a different batch of antique glass: a spectral tint, and sometimes a grisaille.
    const hue = identity.x.pow(1.35).mul(0.88)
    const tint = wavelengthColor(float(392).add(hue.mul(348)))
    const grisaille = identity.y.smoothstep(0.82, 0.93)
    const pot = identity.z
    const glassColor = mix(tint, mix(vec3(0.86, 0.87, 0.8), vec3(0.92, 0.86, 0.7), pot), grisaille)
    const mottle = mx_fractal_noise_float(p.mul(16).add(vec3(3.7, 1.9, 8.1)), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const reamed = mx_fractal_noise_float(p.mul(vec3(26, 140, 26)).add(vec3(9.1, 4.3, 2.7)), 2, 2.1, 0.5).mul(0.5).add(0.5)
    const seeds = cellularPoints(p.mul(74), 0.02, 0.12, 0.6).mul(intimate)
    const crackle = mx_fractal_noise_float(p.mul(52).add(vec3(5.5, 8.3, 1.7)), 2, 2.4, 0.5)
    const crackLine = crackle.abs().smoothstep(0.012, crackle.fwidth().mul(1.2).add(0.012)).oneMinus().mul(near.mul(0.6).add(0.4))
// Beer–Lambert: the longer the crossing through a pane, the deeper and more saturated it reads.
    const crossing = float(1).div(grazing.oneMinus().max(0.18))
    const depth = crossing.mul(0.4).add(0.6)
    const lead = came.mul(0.85).add(cameCore.mul(0.5)).clamp(0, 1)
    let surface = mix(glassColor.mul(mottle.mul(0.16).add(0.92)).mul(0.24), vec3(0.06, 0.065, 0.08), lead)
    surface = mix(surface, vec3(0.05, 0.055, 0.07), innerCame.mul(0.5))
    this.colorNode = surface
    this.metalnessNode = lead.mul(0.65)
    this.roughnessNode = mix(float(0.09), float(0.42), lead).add(reamed.mul(0.05)).add(seeds.mul(0.2)).clamp(0.04, 0.8)
    this.clearcoatNode = lead.oneMinus().mul(0.5)
    this.clearcoatRoughness = 0.08
    this.ior = 1.52
    this.sheenNode = reamed.mul(0.25)
    this.sheenColor.set(hsl.integer(251, 20, 86))
    this.sheenRoughness = 0.5
    const relief = lead.mul(0.0022).sub(cameCore.mul(0.0006)).add(seeds.mul(0.0004)).add(crackLine.mul(0.0002))
    const bump = proceduralNormal(relief, 1.15)
    this.normalNode = bump
// Only derivative-free fields may reach positionNode: a screen footprint does not exist in the vertex
// stage, so the came's own width is measured here from the same bisector distance, unfiltered.
    const cameBody = pane.border.abs().smoothstep(0.082, 0.03)
    const swell = mx_fractal_noise_float(p.mul(6).add(vec3(1.1, 7.3, 4.9)), 2, 2.1, 0.5)
    this.positionNode = positionGeometry.add(normalLocal.mul(swell.mul(0.0009).add(cameBody.mul(0.0009))))
    const sun = p.x.mul(0.55).add(p.y.mul(0.4)).sub(time.mul(0.14))
    const daylight = sun.mul(sun).mul(-1.1).exp()
    const glow = glassColor.mul(depth).mul(grazing.pow(1.4).mul(0.7).add(0.3)).mul(lead.oneMinus().mul(0.94).add(0.06))
    const sparkle = glints(bump, 140).mul(cameCore.mul(0.6).add(seeds.mul(0.4)))
    this.emissiveNode = glow.mul(0.2)
      .add(glow.mul(daylight).mul(0.42))
      .add(color(hsl.integer(83, 100, 93.2)).mul(lead.mul(daylight).mul(0.12)))
      .add(color(hsl.integer(0, 0, 100)).mul(sparkle.mul(0.18)))
      .add(color(hsl.integer(260, 99, 78)).mul(rim.pow(2.4).mul(0.12)))
      .add(color(hsl.integer(65, 100, 80)).mul(grisaille.mul(daylight).mul(0.06).mul(grazing.mul(0.6).add(0.4))))
  }
}
