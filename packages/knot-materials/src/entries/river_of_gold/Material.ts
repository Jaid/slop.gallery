import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(1.5)).mul(0.3)
    const shard = cellularBoundary(p.mul(2.3).add(warp))
    const seam = cellularBoundary(p.mul(6.2).add(warp.mul(1.6)))
    const micro = cellularBoundary(p.mul(14).add(warp.mul(2)))
    const width = mx_noise_float(p.mul(3.4)).mul(0.008).add(0.016)
// The gold fills the fault lines and rises proud of the glaze, as a repair should.
    const vein = filteredRibbon(shard, width).add(filteredRibbon(seam, width.mul(0.55)).mul(0.7)).add(filteredRibbon(micro, width.mul(0.3)).mul(near).mul(0.5)).clamp()
    const ridge = filteredRibbon(shard, width.mul(1.6)).add(filteredRibbon(seam, width.mul(0.9)).mul(0.55)).clamp()
    const height = ridge.mul(0.018).add(mx_noise_float(p.mul(38)).mul(0.0016))
    const surface = proceduralNormal(height, 0.85)
    this.normalNode = surface
    const glaze = mx_fractal_noise_float(p.mul(3), 3, 2, 0.5).mul(0.5).add(0.5)
    const heat = shard.smoothstep(0.02, 0.14).oneMinus()
    const temper = mix(color(hsl.integer(246, 42, 12)), color(hsl.integer(60, 72, 17)), mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5))
    const ceramic = mix(mix(color(hsl.integer(70, 9, 4)), color(hsl.integer(67, 21, 10)), glaze), temper, heat.mul(0.35))
    const gold = mix(color(hsl.integer(64, 88, 52)), color(hsl.integer(83, 100, 85.8)), mx_noise_float(p.mul(11)).mul(0.5).add(0.5))
    this.colorNode = mix(ceramic, gold, vein)
    this.metalnessNode = vein
    this.roughnessNode = mix(float(0.5), float(0.16), vein).sub(glaze.mul(0.06))
    this.aoNode = heat.oneMinus().mul(0.3).add(0.7)
    this.clearcoat = 0.28
    this.clearcoatRoughness = 0.16
    this.envMapIntensity = 0.75
// Old heat still moves through the repair, slowly, like a held breath.
    const flow = p.dot(vec3(0.6, 0.8, 0.35)).mul(2.2).sub(time.mul(1.1)).sin().mul(0.5).add(0.5)
    const pulse = flow.pow(4).mul(0.7).add(0.45)
    const spark = glints(surface, 70).mul(vein).mul(intimate)
    this.emissiveNode = color(hsl.integer(36, 100, 61.1)).mul(vein).mul(pulse).mul(intimate.mul(1.1).add(0.4)).add(color(hsl.integer(62, 100, 73.8)).mul(vein).mul(grazing.pow(2)).mul(0.45)).add(color(hsl.integer(80, 100, 87)).mul(spark).mul(0.35))
  }
}
