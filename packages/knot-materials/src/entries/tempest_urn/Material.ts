import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.4
    const {p, intimate} = viewerFrame()
    const t = time
    const warp = mx_noise_float(p.mul(1.3).add(vec3(t.mul(0.04), t.mul(0.06), 0))).mul(0.65)
    const q = p.mul(2.3).add(warp)
    const coarse = mx_fractal_noise_float(q, 4, 2.15, 0.5).mul(0.5).add(0.5)
    const fine = mx_fractal_noise_float(q.mul(3.6).add(vec3(0, t.mul(0.12), 0)), 3, 2, 0.5).mul(0.5).add(0.5)
    const density = coarse.mul(0.62).add(fine.mul(0.38))
    const shading = density.smoothstep(0.2, 0.8)
    const cloud = mix(mix(color(hsl.integer(275, 23, 9)), color(hsl.integer(272, 23, 29)), density.smoothstep(0.08, 0.4)), color(hsl.integer(265, 25, 85)), shading)
    const slot = t.mul(1.6)
    const strike = mx_cell_noise_float(vec3(slot.floor().add(0.5), 8.8, 3.3)).smoothstep(0.78, 0.82)
    const decay = slot.fract().oneMinus().pow(4)
    const flick = mx_cell_noise_float(vec3(t.mul(24).floor().add(0.5), 2.2, 5.5)).smoothstep(0.28, 0.32).mul(0.45).add(0.55)
    const flash = strike.mul(decay).mul(flick)
    const seedA = mx_cell_noise_float(vec3(slot.floor().add(0.5), 4.4, 6.1))
    const seedB = mx_cell_noise_float(vec3(slot.floor().add(0.5), 9.2, 1.7))
    const lightDir = vec3(seedA.sub(0.5).mul(2), 0.6, seedB.sub(0.5).mul(2)).normalize()
    const lit = normalLocal.dot(lightDir).clamp().pow(2.5)
    const boltField = mx_noise_float(p.mul(12).add(vec3(0, seedA.mul(41), 0))).abs()
    const bolt = filament(boltField, 0.011)
    const rainMask = mx_noise_float(p.mul(5)).smoothstep(0.1, 0.6)
    const rain = opticalLine(p.y.mul(60).add(t.mul(5)).fract().sub(0.5), 0.006).mul(0.12).mul(rainMask)
    this.colorNode = mix(cloud, color(hsl.integer(272, 23, 7)), rain)
    this.metalness = 0
    this.roughness = 0.95
    this.aoNode = shading.mul(0.45).add(0.55)
    this.normalNode = proceduralNormal(coarse.mul(0.7).add(fine.mul(0.3)), 0.011)
    this.emissiveNode = flash.mul(color(hsl.integer(259, 100, 95)).mul(lit).mul(1.1))
      .add(color(hsl.integer(0, 0, 100)).mul(bolt).mul(flash).mul(2.6))
      .add(color(hsl.integer(267, 36, 75)).mul(flash).mul(intimate).mul(0.2))
  }
}
