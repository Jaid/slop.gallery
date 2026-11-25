import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const bark = mx_fractal_noise_float(p.mul(4.5), 4, 2, 0.5).mul(0.5).add(0.5)
    const barkFine = mx_noise_float(p.mul(22)).mul(0.5).add(0.5)
    const w1 = mx_worley_noise_float(p.mul(6.5).add(vec3(0, time.mul(0.03), 0)))
    const w2 = mx_worley_noise_float(p.mul(6.5).add(vec3(4.7, 2.9, 1.4)))
    const mother = filament(w1.sub(w2), 0.05)
    const w3 = mx_worley_noise_float(p.mul(16).add(vec3(time.mul(-0.02), 0, 0)))
    const w4 = mx_worley_noise_float(p.mul(16).add(vec3(8.3, 5.1, 2.2)))
    const hairs = filament(w3.sub(w4), 0.03).mul(intimate.mul(0.8).add(0.2))
    const network = mother.add(hairs.mul(0.7)).clamp()
    const travel = p.y.mul(2.5).add(p.x.mul(1.5)).sub(time.mul(1.1)).sin().mul(0.5).add(0.5)
    const breath = time.mul(0.7).sin().mul(0.5).add(0.5)
    const energy = travel.mul(0.6).add(breath.mul(0.4)).add(0.25)
    const sq = p.sub(view.mul(0.06)).mul(30)
    const srnd = cellNoiseVec3(sq)
    const srnd2 = cellNoiseVec3(sq.add(27.3))
    const sdist = sq.fract().sub(srnd.mul(0.6).add(0.2)).length()
    const sfoot = sq.fwidth().length().max(0.001)
    const score = sdist.smoothstep(0, sfoot.mul(1).max(0.05)).oneMinus()
    const sgate = srnd2.x.smoothstep(0.86, 0.9)
    const stw = time.mul(srnd2.y.mul(4).add(1)).add(srnd2.z.mul(25)).sin().mul(0.35).add(0.75)
    const spores = score.mul(sgate).mul(stw).mul(intimate.mul(0.7).add(near.mul(0.3))).mul(sfoot.smoothstep(0.25, 1).oneMinus())
    const barkCol = mix(color(hsl.integer(65, 23, 5)), color(hsl.integer(58, 49, 14)), bark)
    const goldHint = color(hsl.integer(82, 70, 47))
    this.colorNode = mix(barkCol, goldHint, network.mul(0.35))
    this.metalnessNode = network.mul(0.2)
    this.roughnessNode = float(0.88).sub(network.mul(0.45)).sub(barkFine.mul(0.1))
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.4
    this.normalNode = proceduralNormal(bark.mul(0.8).add(barkFine.mul(0.25)), 0.003)
    const oracleTint = cosinePalette(bark.mul(1.2).add(time.mul(0.03)).add(view.x.mul(0.2)), [0.55, 0.68, 0.25], [0.45, 0.35, 0.15], [1, 1, 1], [0.1, 0.35, 0.6])
    this.emissiveNode = oracleTint.mul(network).mul(energy).mul(2.4).mul(facing.mul(0.5).add(0.5)).add(color(hsl.integer(124, 100, 94)).mul(spores).mul(2.2)).add(oracleTint.mul(rim).mul(0.28))
  }
}
