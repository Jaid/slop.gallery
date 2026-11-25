import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, uv, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const pile = mx_fractal_noise_float(p.mul(18), 3, 2.2, 0.45)
    const nap = mx_noise_float(p.mul(42).add(vec3(tube.x.mul(6), 0, tube.y.mul(2))))
    const crush = facing.smoothstep(0.18, 0.72)
    const bloom = grazing.pow(2.4).mul(near.mul(0.35).add(0.65))
    const warpThread = opticalLine(tube.y.mul(7).add(tube.x.mul(18)).add(pile.mul(0.35)).fract().sub(0.5), 0.04).mul(intimate)
    const pileColor = mix(color(hsl.integer(61, 56, 18)), color(hsl.integer(80, 56, 82)), bloom)
    const voidColor = mix(color(hsl.integer(55, 24, 3)), color(hsl.integer(51, 32, 6)), nap.mul(0.12).add(0.04))
    this.envMapIntensity = 0.12
    this.colorNode = mix(voidColor, pileColor.mul(0.22), bloom.mul(0.45))
    this.metalness = 0
    this.roughnessNode = crush.mul(0.22).add(0.62).sub(warpThread.mul(0.08))
    this.sheenNode = mix(color(hsl.integer(56, 42, 11)), color(hsl.integer(84, 62, 87)), bloom.add(warpThread.mul(0.35)))
    this.sheenRoughnessNode = float(0.42).mix(0.18, grazing.pow(1.5))
    this.anisotropy = 0.72
    this.clearcoat = 0
    this.normalNode = proceduralNormal(pile.mul(0.55).add(nap.mul(0.45)), 0.012)
    this.emissiveNode = color(hsl.integer(84, 62, 82))
      .mul(bloom)
      .mul(0.07)
      .mul(near.mul(0.5).add(0.4))
      .add(color(hsl.integer(64, 67, 43)).mul(warpThread).mul(glints(normalViewGeometry, 48)).mul(0.35))
      .add(color(hsl.integer(54, 56, 8)).mul(rim).mul(0.08))
  }
}
