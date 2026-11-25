import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {hairline as opticalLine} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Lightning in a bottle: branching arcs re-strike toward whoever stands closest, the storm barely smouldering from across the room and raging at arm's length. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tick = time.mul(3).floor()
    const seed = mx_cell_noise_float(vec3(tick, 3.1, 7.7))
    const seed2 = mx_cell_noise_float(vec3(tick, 9.4, 1.2))
    const frac = time.mul(3).fract()
    const activity = float(0.3).add(near.mul(0.7))
    const strikeChance = seed.smoothstep(0.42, 0.85).mul(activity)
    const strike = strikeChance.mul(frac.mul(-6).exp())
    const afterglow = strikeChance.mul(frac.mul(-1.6).exp())
    const q = p.sub(view.mul(float(0.05).add(intimate.mul(0.06))))
    const warp = vec3(seed.mul(19.7), seed2.mul(7.3), seed.mul(-11.9))
    const arcField = mx_noise_float(q.mul(8).add(warp)).add(mx_noise_float(q.mul(17).add(warp.mul(2.1))).mul(0.45))
    const core = opticalLine(arcField, 0.012)
    const halo = opticalLine(arcField, 0.09)
    const idleArcs = opticalLine(mx_noise_float(q.mul(5).add(vec3(time.mul(0.21), time.mul(-0.17), time.mul(0.25)))), 0.05)
    const flicker = time.mul(43).sin().mul(0.12).add(0.88)
    const side = facing.pow(1.2).mul(0.7).add(0.3)
    const arcColor = mix(color(hsl.integer(264, 99, 58)), color(hsl.integer(243, 100, 98)), core.clamp())
    const sq = p.mul(15)
    const srnd = cellNoiseVec3(sq)
    const sparks = sq.fract().sub(srnd.mul(0.6).add(0.2)).length().smoothstep(0.02, 0.3).oneMinus().mul(srnd.y.smoothstep(0.55, 0.9)).mul(strike.mul(2.2))
    this.colorNode = color(hsl.integer(297, 49, 7))
    this.transmission = 0.78
    this.roughness = 0.07
    this.ior = 1.45
    this.thickness = 0.3
    this.dispersion = 0.25
    this.attenuationColor.set(hsl.integer(299, 72, 13))
    this.attenuationDistance = 0.5
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.envMapIntensity = 1.1
    this.emissiveNode = arcColor.mul(core.mul(strike).mul(4).add(halo.mul(strike).mul(1.1)).add(idleArcs.mul(0.14)).mul(side)).mul(flicker).add(color(hsl.integer(294, 63, 25)).mul(strike).mul(0.5)).add(color(hsl.integer(291, 100, 55)).mul(grazing.pow(2)).mul(afterglow).mul(0.7)).add(color(hsl.integer(230, 100, 95)).mul(sparks).mul(facing))
  }
}
