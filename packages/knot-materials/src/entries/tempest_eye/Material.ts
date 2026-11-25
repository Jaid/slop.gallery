import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    view
    grazing
    const swirlA = time.mul(0.35)
    const twist = p.y.mul(4).add(swirlA)
    const cs = twist.cos()
    const sn = twist.sin()
    const rx = p.x.mul(cs).sub(p.z.mul(sn))
    const rz = p.x.mul(sn).add(p.z.mul(cs))
    const stormQ = vec3(rx.mul(2.8), p.y.mul(5.5).sub(time.mul(0.25)), rz.mul(2.8))
    const clouds = mx_fractal_noise_float(stormQ, 4, 2, 0.55).mul(0.5).add(0.5)
    const streaks = mx_noise_float(vec3(p.x.mul(10), p.y.mul(28).sub(time.mul(1.8)), p.z.mul(10))).mul(0.5).add(0.5)
    const eye = facing.smoothstep(0.45, 0.85)
    const flashTick = time.mul(1.7).floor()
    const flashRnd = mx_cell_noise_float(vec3(flashTick.mul(0.37), 4.7, 9.1))
    const flash = flashRnd.smoothstep(0.68, 0.82).mul(1.5).add(0.12)
    const boltField = mx_noise_float(p.mul(16).add(vec3(0, time.mul(1.2), time.mul(0.4)))).mul(0.5).add(0.5)
    const bolts = filament(boltField.mul(2).sub(1), 0.06).mul(flash).mul(near.mul(0.6).add(0.4))
    const rainPhase = p.y.mul(140).add(p.x.mul(20)).sub(time.mul(22))
    const rain = opticalBands(rainPhase).mul(intimate).mul(0.6)
    this.colorNode = mix(mix(color(hsl.integer(270, 48, 6)), color(hsl.integer(265, 39, 32)), clouds), color(hsl.integer(81, 100, 93.3)), eye.mul(0.75))
    this.metalness = 0.05
    this.roughnessNode = float(0.62).sub(clouds.mul(0.2)).add(eye.mul(-0.15))
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.2
    this.anisotropy = 0.6
    this.normalNode = proceduralNormal(clouds.mul(0.9).add(streaks.mul(0.2)), 0.0035)
    const boltTint = mix(color(hsl.integer(285, 100, 60.5)), color(hsl.integer(236, 100, 96)), boltField)
    this.emissiveNode = boltTint.mul(bolts).mul(3.5).add(color(hsl.integer(276, 100, 61.5)).mul(rim).mul(0.7).mul(flash)).add(color(hsl.integer(75, 100, 86)).mul(eye).mul(0.9).mul(intimate.mul(0.6).add(0.4))).add(color(hsl.integer(272, 100, 49)).mul(clouds.oneMinus()).mul(rim.mul(rim).mul(rim)).mul(0.8)).add(color(hsl.integer(275, 100, 76.5)).mul(rain).mul(0.5))
  }
}
