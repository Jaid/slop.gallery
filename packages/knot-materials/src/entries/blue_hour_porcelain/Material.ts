import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, positionGeometry, time, uv, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.58)
    this.name = knotData.id
    const {near, grazing} = viewerFrame()
    const p = positionGeometry
    const drift = mx_noise_float(p.mul(5).add(vec3(time.mul(0.02), 0, 0)))
    const whorl = mx_noise_float(p.mul(13)).mul(2)
    const wave = uv().x.mul(6.283185307179586 * 6).add(uv().y.mul(6.283185307179586 * 2)).add(drift.mul(5)).add(whorl).sin()
    const porcelain = wave.smoothstep(-0.2, 0.3)
    const inkEdge = filament(wave.sub(0.15), 0.085)
    const stipple = mx_noise_float(p.mul(63)).mul(0.5).add(0.5)
// Cobalt is the ground; porcelain-white cloudbanks are laid down in moving brush strokes.
    this.colorNode = mix(color(hsl.integer(261, 84, 14)), color(hsl.integer(101, 21, 86)), porcelain.mul(0.85)).mul(stipple.mul(0.055).add(0.94))
    this.metalness = 0.04
    this.roughnessNode = porcelain.mul(0.06).add(0.26)
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.11
    this.normalNode = proceduralNormal(drift.mul(0.003).add(inkEdge.mul(0.002)), 0.65)
    this.emissiveNode = color(hsl.integer(251, 61, 41)).mul(inkEdge).mul(near.mul(0.09).add(0.03)).add(color(hsl.integer(95, 37, 95)).mul(grazing.pow(3)).mul(0.03))
  }
}
