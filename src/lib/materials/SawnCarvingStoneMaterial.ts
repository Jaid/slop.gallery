import {color, float, max, mix, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/** An unpolished carving blank: warm chalk-white stone, with open grain and the shallow sweeps of the quarry saw. */
export default class SawnCarvingStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({roughness: 0.94})
    this.name = 'Sawn carving stone'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth()))
    const cloud = mx_noise_float(p.mul(4.2)).mul(0.5).add(0.5)
    const meal = mx_noise_float(p.mul(75)).mul(visibleDetail(footprint, 1 / 75))
    const grain = mx_noise_float(p.mul(320)).mul(visibleDetail(footprint, 1 / 320))
    const pores = meal.smoothstep(0.42, 0.7)
    // A blade leaves fine, unevenly spaced arcs. Its teeth only score patches of the cut deeply enough to show.
    const course = p.z.add(p.y.mul(0.72)).add(p.x.add(0.6).pow2().mul(0.17))
    const score = mx_noise_float(vec3(course.mul(100), p.x.mul(0.9), 8)).smoothstep(0.18, 0.58)
      .mul(mx_noise_float(p.mul(3).add(7)).smoothstep(-0.45, 0.4)).mul(visibleDetail(footprint, 0.013))
    const stone = mix(color('#e9e5d9'), color('#d3c7ae'), cloud)
    this.colorNode = stone.mul(float(1).add(meal.mul(0.045)).add(grain.mul(0.1)).sub(pores.mul(0.07)).add(score.mul(0.06)))
    this.normalNode = heightNormal(grain.mul(0.00022).add(meal.mul(0.00035)).sub(pores.mul(0.0006)).sub(score.mul(0.00065)))
  }
}
