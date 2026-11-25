import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
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
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const deep = p.sub(view.mul(0.34))
    const drift = vec3(time.mul(0.04), time.mul(-0.03), time.mul(0.02))
    const soulRaw = mx_fractal_noise_float(deep.mul(3.6).add(drift), 3, 2, 0.5).mul(0.5).add(0.5)
    const soulVeins = filament(soulRaw.mul(2).sub(1), 0.14)
    const soulFine = opticalLine(mx_noise_float(deep.mul(16).add(drift.mul(2))).mul(2.5).sin(), 0.04).mul(near)
    const bubblesQ = deep.mul(38)
    const bubblesRnd = cellNoiseVec3(bubblesQ)
    const bubblesRnd2 = cellNoiseVec3(bubblesQ.add(11.3))
    const bubDist = bubblesQ.fract().sub(bubblesRnd.mul(0.5).add(0.25)).length()
    const bubFoot = bubblesQ.fwidth().length().max(0.001)
    const bubbles = bubDist.smoothstep(0.18, bubFoot.add(0.18)).oneMinus().mul(bubblesRnd2.x.smoothstep(0.75, 0.8)).mul(bubFoot.smoothstep(0.3, 1).oneMinus()).mul(intimate.mul(0.8).add(0.2))
    const frost = grazing.pow(2.2)
    this.colorNode = mix(mix(color(hsl.integer(240, 66, 15)), color(hsl.integer(236, 100, 89)), facing.mul(0.75)), color(hsl.integer(0, 0, 100)), frost.mul(0.85))
    this.transmission = 0.95
    this.thickness = 1.1
    this.ior = 1.31
    this.dispersion = 0.25
    this.attenuationColor.set(hsl.integer(239, 100, 83.3))
    this.attenuationDistance = 0.9
    this.roughnessNode = float(0.06).add(frost.mul(0.45)).add(soulRaw.mul(0.05))
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(soulRaw.mul(0.7).add(mx_noise_float(p.mul(22)).mul(0.2)), 0.0015)
    const soulTint = mix(color(hsl.integer(213, 99, 85.5)), color(hsl.integer(78, 100, 89)), soulRaw.add(view.y.mul(0.3)).clamp())
    this.emissiveNode = soulTint.mul(soulVeins).mul(1.8).mul(facing.mul(0.6).add(0.4)).add(color(hsl.integer(217, 100, 91.6)).mul(soulFine).mul(0.9).mul(near)).add(color(hsl.integer(0, 0, 100)).mul(bubbles).mul(1.2)).add(color(hsl.integer(237, 99, 76.6)).mul(rim).mul(0.22))
  }
}
