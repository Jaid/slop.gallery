import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, mx_worley_noise_vec3, normalLocal, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A pocket photosphere. Granules are white-hot, the lanes stay ember-dark, and the limb reddens wherever the surface turns away. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.18)
    this.name = knotData.id
    const {p, facing, grazing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const q = p.mul(9.2).add(vec3(time.mul(0.28), time.mul(0.12), time.mul(-0.18)))
    const dist = mx_worley_noise_vec3(q, 1, 0)
    const granule = dist.x.smoothstep(0.02, 0.36).oneMinus()
    const lane = dist.y.sub(dist.x).smoothstep(0, 0.2).oneMinus()
    const warp = mx_noise_float(q.mul(0.33))
    const cells = q.dot(vec3(1.6, 2.2, 1.15)).add(warp.mul(2.8)).sin().abs().smoothstep(0.18, 0.9)
    const shape = cells.mul(granule.mul(0.7).add(0.3)).mul(lane.oneMinus().mul(0.75).add(0.25))
    const detail = mix(shape.mul(0.5).add(0.18), shape, proximity.mul(0.84).add(0.16))
    const plage = mx_noise_float(p.mul(1.7).add(vec3(0, time.mul(0.07), 0))).mul(0.5).add(0.5)
    const heat = detail.mul(plage.mul(0.4).add(0.6))
    const mu = facing.pow(0.55)
    const warmth = heat.smoothstep(0.06, 0.58)
    const tint = mix(color(hsl.integer(31, 96.6, 37.4)), color(hsl.integer(83, 100, 97.5)), warmth.mul(mu.mul(0.42).add(0.58)))
    const intensity = warmth.mul(1.65).add(0.18).mul(mu.mul(0.58).add(0.24))
    const tube = uv()
    const crownCenter = time.mul(0.07).fract()
    const wrap = tube.x.sub(crownCenter).abs()
    const arch = wrap.min(float(1).sub(wrap)).smoothstep(0, 0.08).oneMinus()
    const crown = tube.y.mul(TAU).sin().mul(0.5).add(0.5)
    const band = arch.mul(crown)
    const pointScale = p.mul(30)
    const points = cellularPoints(pointScale, 0.018, 0.07, 0.84)
    const pointFade = pointScale.fwidth().length().smoothstep(0.5, 0.14).oneMinus()
    const twinkle = time.mul(5).add(mx_cell_noise_float(pointScale.floor()).mul(30)).sin().mul(0.5).add(0.5)
    const spark = points.mul(lane).mul(twinkle.pow(2)).mul(pointFade).mul(proximity.mul(0.75).add(0.2))
    this.colorNode = tint.mul(0.08)
    this.emissiveNode = tint.mul(intensity)
      .add(color(hsl.integer(85, 100, 98.4)).mul(spark).mul(1.6))
      .add(color(hsl.integer(70, 100, 96.5)).mul(band).mul(grazing.mul(0.7).add(0.25)).mul(0.7))
      .add(color(hsl.integer(36, 100, 61.6)).mul(arch).mul(crown.smoothstep(0.12, 0.85)).mul(grazing).mul(0.35))
    this.metalness = 0
    this.roughness = 0.62
    this.normalNode = proceduralNormal(heat, 0.02)
    this.positionNode = p.add(normalLocal.mul(granule.mul(0.012).add(band.mul(0.007))))
  }
}
