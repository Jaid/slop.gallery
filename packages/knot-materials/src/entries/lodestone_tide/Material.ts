import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, Fn, modelWorldMatrixInverse, mx_noise_float, positionViewDirection, time, transformNormalToView, uv, vec2, vec3, vec4} from 'three/tsl'

import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {knotCircumference, knotLength, tubeCells, tubeMetric} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {wrap} from '../../candidates/claude_opus/lib/wrap.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Spike columns along the knot; even, so the staggered hexagonal rows close over the seam. */
const columns = 122
/** Spikes around the tube; with 122 columns the lattice is within 0.2% of a regular hexagonal Rosensweig pattern. */
const rows = 12
const columnPitch = knotLength / columns
const rowPitch = knotCircumference / rows
const spikeRadius = 0.036
const peakHeight = 0.046
/** Rosensweig instability: the tallest of the six nearest spikes on a staggered lattice, each with a sharp tip and concave flanks. Returns the normalized height (0–1). */
const spikeProfile = Fn(([tube]: [Node<'vec2'>]) => {
  const cells = tubeCells(tube, columns, rows)
  let best: Node<'float'> = float(0)
  for (const di of [-1, 0, 1]) {
    for (const dj of [0, 1]) {
      const column = cells.x.floor().add(di)
      const parity = wrap(column, 2)
      const row = cells.y.sub(parity.mul(0.5)).sub(0.5).floor().add(dj)
      const center = vec2(column.add(0.5), row.add(parity.mul(0.5)).add(0.5))
      const random = cellNoiseVec3(vec3(wrapCell(vec2(column, row), vec2(columns, rows)), 3.3))
      const radius = random.x.mul(0.3).add(0.85).mul(spikeRadius)
      const distance = cells.sub(center).mul(vec2(columnPitch, rowPitch)).length()
      const t = distance.div(radius).oneMinus().max(0)
// Each spike trembles at its own rate, as a real ferrofluid does in a slightly alternating field.
      const tremble = time.mul(random.z.mul(5).add(5)).add(random.y.mul(TAU)).sin().mul(0.035).add(1)
      best = best.max(t.mul(t).mul(random.y.mul(0.35).add(0.75)).mul(tremble))
    }
  }
  return best
})
/** The magnetization: a calm skin far away, rising toward a visitor and swelling with slow tides along the knot. */
const fieldStrength = Fn(([tube, base, normal]: [Node<'vec2'>, Node<'vec3'>, Node<'vec3'>]) => {
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const toCamera = cameraLocal.sub(base)
  const distance = toCamera.length()
  const attraction = distance.smoothstep(0.95, 3.6).oneMinus()
  const facing = normal.dot(toCamera.div(distance)).smoothstep(-0.35, 0.85)
  const along = tubeMetric(tube).x.div(knotLength)
  const tide = along.mul(TAU * 3).sub(time.mul(0.9)).sin().mul(0.5).add(0.5)
  const swell = along.mul(TAU * 7).add(time.mul(0.55)).sin().mul(0.5).add(0.5)
  return attraction.mul(facing.mul(0.65).add(0.35)).mul(0.8).add(0.2).mul(tide.mul(0.22).add(swell.mul(0.08)).add(0.7))
})
/** Displaced surface point; spikes lean toward the visitor in proportion to their height. */
const surface = Fn(([tube]: [Node<'vec2'>]) => {
  const frame = knotFrame(tube)
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const field = fieldStrength(tube, frame.position, frame.normal)
  const height = spikeProfile(tube).mul(field).mul(peakHeight)
  const toCamera = cameraLocal.sub(frame.position).normalize()
  const lateral = toCamera.sub(frame.normal.mul(toCamera.dot(frame.normal)))
  const lean = lateral.mul(field.mul(0.55)).mul(height)
  return vec4(frame.position.add(frame.normal.mul(height)).add(lean), height.div(peakHeight))
})
/** Ferrofluid: black liquid iron in oil, a dark mirror that grows a hexagonal crown of thorns as a visitor approaches. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = surface(tube).xyz
// Shading normals come from the exact displaced surface, evaluated per pixel, so needle tips stay razor sharp.
    const here = surface(tube)
    const epsU = 0.00008
    const epsV = 0.0006
    const du = surface(tube.add(vec2(epsU, 0))).xyz.sub(surface(tube.sub(vec2(epsU, 0))).xyz)
    const dv = surface(tube.add(vec2(0, epsV))).xyz.sub(surface(tube.sub(vec2(0, epsV))).xyz)
    const normalObject = du.cross(dv).normalize()
    const normal = transformNormalToView(normalObject).normalize()
    this.normalNode = normal
    const height = here.w
// Oil film thickness thins toward each tip, so tips flash violet-green while the valleys stay neutral.
    const film = mx_noise_float(here.xyz.mul(30)).mul(60).add(height.mul(-180)).add(420)
    this.colorNode = color(hsl.integer(264, 9, 55))
    this.metalness = 1
    this.roughness = 0.08
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.iridescence = 0.55
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = film
    this.aoNode = height.smoothstep(0, 0.5).mul(0.5).add(0.5)
// A light-painting studio mirrored in the liquid: a cold strip overhead, a warm horizon band. It gives the black mirror its silhouette.
    const reflected = positionViewDirection.negate().reflect(normal)
    const overhead = reflected.y.max(0).pow(5)
    const horizon = reflected.y.sub(-0.05).div(0.09).pow2().negate().exp()
    const facing = normal.dot(positionViewDirection).clamp()
    const fresnel = facing.oneMinus().pow(3).mul(0.75).add(0.25)
    this.emissiveNode = color(hsl.integer(264, 100, 61.5)).mul(overhead).mul(0.55).add(color(hsl.integer(52, 99, 71)).mul(horizon).mul(0.35)).mul(fresnel)
  }
}
