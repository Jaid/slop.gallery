import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalLocal, positionLocal, time} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Ancient granite breathing with bioluminescent lichen - hyper detail up close */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, rim, near} = viewerFrame()
    const stoneNoise = mx_fractal_noise_float(p.mul(1.8), 3, 2, 0.55)
    const stoneColor = mix(color(hsl.integer(179, 5, 20)), color(hsl.integer(161, 8, 28)), stoneNoise.mul(0.5).add(0.5))
    const worley = mx_worley_noise_float(p.mul(6.2))
    const shelterMask = worley.oneMinus().smoothstep(0.35, 0.75)
    const lichenNoise = mx_noise_float(p.mul(4.5))
    const lichenBaseMask = lichenNoise.smoothstep(0.25, 0.65).mul(shelterMask)
    const detailLichen = mx_noise_float(p.mul(22)).mul(lichenBaseMask)
    const breath = time.mul(0.35).sin().mul(0.15).add(0.85)
    const lichenTint1 = color(hsl.integer(149.6, 100, 85.7))
    const lichenTint2 = color(hsl.integer(135.5, 100, 89.5))
    const fruiting = color(hsl.integer(95, 100, 89.5))
    const lichenColor = mix(lichenTint1, lichenTint2, mx_noise_float(p.mul(8)).mul(0.5).add(0.5))
    const fruitMask = cellularPoints(p.mul(28), 0.06, 0.24, 0.88).mul(lichenBaseMask)
    this.positionNode = positionLocal.add(normalLocal.mul(lichenBaseMask.mul(0.025).mul(near).mul(detailLichen.mul(0.5).add(0.5))))
    this.colorNode = mix(stoneColor, lichenColor, lichenBaseMask.mul(0.85)).add(fruiting.mul(fruitMask).mul(0.6))
    this.roughnessNode = float(0.85).sub(lichenBaseMask.mul(0.45)).add(detailLichen.mul(0.1))
    this.metalness = 0
    this.clearcoat = 0.1
    this.clearcoatRoughness = 0.8
    this.normalNode = proceduralNormal(stoneNoise.mul(0.5).add(detailLichen.mul(lichenBaseMask).mul(0.8)), 0.0012)
    this.emissiveNode = lichenColor.mul(lichenBaseMask).mul(breath).mul(0.35)
      .add(fruiting.mul(fruitMask).mul(breath).mul(0.9))
      .add(lichenTint1.mul(rim.pow(2).mul(lichenBaseMask).mul(0.18)))
      .mul(near.mul(0.6).add(0.4))
    this.envMapIntensity = 0.4
  }
}
