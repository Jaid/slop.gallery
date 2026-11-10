import type {Node} from 'three/webgpu'

import {texture, vec2} from 'three/tsl'
import {ClampToEdgeWrapping, DataTexture, FloatType, LinearFilter, RGBAFormat} from 'three/webgpu'

import {knotGeometryArgs} from '../../../geometry.ts'

const [radius,,,, p, q] = knotGeometryArgs
/** Texels in the arc-length table. Linear filtering interpolates between them. */
const samples = 2048
/** Chord-length integration steps per table texel. */
const substeps = 32
/** TorusKnotGeometry's centerline, sampled at its own parameter `u` (0 to p·2π). */
const centerline = (u: number) => {
  const phase = q / p * u
  const r = radius * (2 + Math.cos(phase)) * 0.5
  return [r * Math.cos(u), r * Math.sin(u), radius * Math.sin(phase) * 0.5] as const
}
const createTable = () => {
  const totalU = p * Math.PI * 2
  const steps = (samples - 1) * substeps
  const cumulative = new Float64Array(samples)
  let previous = centerline(0)
  let length = 0
  for (let k = 1;k <= steps;k++) {
    const point = centerline(totalU * k / steps)
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2])
    previous = point
    if (k % substeps === 0) {
      cumulative[k / substeps] = length
    }
  }
  const data = new Float32Array(samples * 4)
  for (let i = 0;i < samples;i++) {
    data[i * 4] = cumulative[i] / length
    data[i * 4 + 3] = 1
  }
  const table = new DataTexture(data, samples, 1, RGBAFormat, FloatType)
  table.name = 'Knot arc length'
  table.minFilter = LinearFilter
  table.magFilter = LinearFilter
  table.wrapS = ClampToEdgeWrapping
  table.needsUpdate = true
  return table
}
let table: DataTexture | undefined
/** Shared, lazily built lookup from uv.x to normalized centerline arc length. */
export function knotArcLengthTable() {
  table ??= createTable()
  return table
}
/**
 * Normalized centerline arc length at uv.x, in [0, 1]. The table is sampled at texel centers, so the
 * seam at uv.x = 0 and uv.x = 1 maps exactly onto the two ends without drift.
 * Raw uv.x is not arc length: the knot's thin sections would be stretched, its long sections compressed.
 */
export function knotArcLength(u: Node<'float'>) {
  const texel = 1 / samples
  return texture(knotArcLengthTable(), vec2(u.mul(1 - texel).add(texel * 0.5), 0.5)).x
}
