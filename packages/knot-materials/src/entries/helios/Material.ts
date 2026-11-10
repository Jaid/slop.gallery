import type {Node, Texture} from 'three/webgpu'

import {atan, color, float, mix, mx_noise_float, mx_worley_noise_vec3, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {tubeDelta, tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const spotCenters = [[2.7, 0.36], [3.05, 0.69], [5.75, 0.22]] as const
/**
 * The photosphere as a living convection experiment: polygonal granules with dark
 * intergranular lanes, a sunspot group with a filamentary penumbra, magnetic bright
 * points in the lanes and a hot chromospheric rim at the limb.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.12)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(uv())
// The boiling warp is what makes the granulation move without sliding the cells.
    const boil = mx_noise_float(vec3(metric.mul(2.4), time.mul(0.055)))
    const wisp = mx_noise_float(vec3(metric.x.mul(4.1).add(boil), metric.y.mul(3.8).sub(boil), time.mul(0.04).add(4.2)))
    const warp = vec2(wisp, boil.mul(0.8))
    const granulationAt = (scale: number, seed: number) => {
      const q = vec3(metric.mul(scale).add(warp.mul(scale * 0.045)), seed)
      const cells = mx_worley_noise_vec3(q, 1, 0)
      const lanes = cells.y.sub(cells.x)
      const cell = q.floor()
      const rnd = cellNoiseVec3(cell)
      const body = lanes.smoothstep(0.01, 0.17).pow(0.78)
      const variation = rnd.x.mul(0.42).add(0.78)
      return {
        body,
        variation,
        lane: body.oneMinus(),
        cells,
        rnd,
      }
    }
    const large = granulationAt(12.5, 1.7)
    const small = granulationAt(41, 8.4)
    const micro = mx_noise_float(vec3(metric.x.mul(210), metric.y.mul(210), time.mul(0.08)))
    const microDetail = micro.mul(0.5).add(0.5).mul(near.mul(0.55).add(0.2))
// Convective heat: broad cells carry the light, smaller granules break their edges.
    let heat: Node<'float'> = large.body.mul(large.variation).mul(0.62)
      .add(small.body.mul(small.variation).mul(near.mul(0.2).add(0.09)))
      .add(microDetail.mul(0.055))
    heat = heat.add(0.025).clamp(0.01, 1.05)
// Sunspot groups: a dark umbra, a radially striated penumbra and a warming moat.
    let spotMask: Node<'float'> = float(0)
    let umbraMask: Node<'float'> = float(0)
    let penumbraMask: Node<'float'> = float(0)
    let filament: Node<'float'> = float(0)
    for (const [index, [u, v]] of spotCenters.entries()) {
      const radius = index === 0 ? 0.19 : (index === 1 ? 0.105 : 0.075)
      const delta = tubeDelta(metric, vec2(u, v))
      const r = delta.length()
      const outer = ramp(r, radius, radius * 0.57)
      const umbra = ramp(r, radius * 0.5, radius * 0.27)
      const penumbra = outer.mul(umbra.oneMinus())
      const angle = atan(delta.y, delta.x.add(1e-6))
      const streakNoise = mx_noise_float(vec3(angle.mul(2.1).add(index * 7.3), r.mul(28), time.mul(0.07)))
      const streaks = angle.mul(42).add(streakNoise.mul(3.2)).sin().mul(0.5).add(0.5)
      spotMask = spotMask.max(outer)
      umbraMask = umbraMask.max(umbra)
      penumbraMask = penumbraMask.max(penumbra)
      filament = filament.max(penumbra.mul(streaks))
    }
    const penumbraGlow = penumbraMask.mul(filament.mul(0.7).add(0.3))
// Magnetic bright points: tiny white-hot feet in the intergranular lanes.
    const pointField = mx_worley_noise_vec3(vec3(metric.mul(118), 5.3), 1, 0)
    const brightPoints = ramp(pointField.x, 0.055, 0.004).pow(2)
      .mul(large.lane.pow(2)).mul(near.mul(0.8).add(0.2))
// Color is blackbody-like: wine-dark lanes, orange-white granule faces, blue-white points.
    const heatColor = mix(color('#1c0200'), color('#8f1b00'), heat.smoothstep(0.02, 0.38))
    const hotColor = mix(heatColor, color('#ff6400'), heat.smoothstep(0.28, 0.74))
    const whiteColor = mix(hotColor, color('#ffe5ad'), heat.smoothstep(0.84, 1.06))
    const colored = whiteColor.mul(heat.mul(0.62).add(0.24))
    const spotColor = mix(color('#070000'), color('#5d0900'), penumbraGlow).mul(0.32)
    const sun = mix(colored, spotColor, spotMask.mul(0.94))
      .add(color('#ff4b00').mul(penumbraGlow).mul(0.55))
      .add(color('#dcecff').mul(brightPoints).mul(2.8))
// At the limb we see higher, cooler layers: the continuum dims while the
// chromosphere and its spicules rise into a thin red-gold fire.
    const limb = facing.pow(0.38)
    const chromosphere = grazing.pow(3.1).mul(mx_noise_float(vec3(metric.mul(42), time.mul(0.2))).mul(0.45).add(0.72))
    const spicules = metric.y.div(0.13).mul(38).add(mx_noise_float(vec3(metric.mul(60), time.mul(0.17))).mul(7)).sin().mul(0.5).add(0.5).pow(3.2).mul(grazing.pow(2.2))
    const radiance = sun.mul(limb.mul(0.78).add(0.22)).add(color('#ff2500').mul(chromosphere).mul(0.62)).add(color('#ffb070').mul(spicules).mul(intimate.mul(0.5).add(0.28)))
    this.colorNode = color('#070100')
    this.roughness = 0.62
    this.metalness = 0
    this.emissiveNode = radiance.mul(0.9)
    this.envMapIntensity = 0.05
    this.aoNode = spotMask.oneMinus().mul(0.35).add(0.65)
  }
}
