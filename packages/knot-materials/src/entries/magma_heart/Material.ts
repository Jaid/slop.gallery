import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** obsidian crust over a molten core; veins beat like a heart, hotter as you approach */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.5
    const {p, view, rim, near, intimate} = viewerFrame()
    const shallow = p.sub(view.mul(0.05))
    const crust = mx_fractal_noise_float(p.mul(7), 4, 2, 0.5)
    const crackFieldA = mx_fractal_noise_float(shallow.mul(5.5), 3, 2, 0.55)
    const crackFieldB = mx_fractal_noise_float(shallow.mul(11).add(vec3(7.3, 1.1, 4.9)), 2, 2, 0.5)
    const cracksWide = filament(crackFieldA, 0.1)
    const cracksFine = filament(crackFieldB, 0.045).mul(intimate.mul(0.8).add(0.2))
    const crackMask = cracksWide.max(cracksFine).clamp()
    const beat = time.mul(1.6).fract()
    const thump = beat.mul(-14).exp().add(beat.sub(0.22).abs().mul(-30).exp().mul(0.6))
    const heat = thump.mul(0.8).add(0.6).add(near.mul(0.35))
    const deepGlow = mx_noise_float(p.sub(view.mul(0.2)).mul(4)).mul(0.5).add(0.5)
    const lava = mix(color(hsl.integer(32, 100, 58.5)), color(hsl.integer(82.4, 100, 82.3)), cracksWide.pow(2).mul(heat).add(deepGlow.mul(0.3)).clamp())
    // Round drifting embers rather than illuminated spatial cells.
    const embers = cellularPoints(p.mul(90).add(vec3(0, time.mul(0.35), 0)), 0.025, 0.16, 0.7).mul(intimate)
    this.colorNode = mix(color(hsl.integer(18, 6, 5)), color(hsl.integer(41, 26, 14)), crust.mul(0.5).add(0.5).pow(2))
    this.metalness = 0
    this.roughnessNode = crust.mul(0.5).add(0.5).mul(0.35).add(0.55).sub(crackMask.mul(0.3)).clamp()
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.5
    this.normalNode = proceduralNormal(crackFieldA.mul(0.6).add(crust.mul(0.4)), 0.0028)
    this.emissiveNode = lava.mul(crackMask).mul(heat.mul(1.6))
      .add(lava.mul(cracksWide.pow(0.6)).mul(0.25))
      .add(color(hsl.integer(38, 100, 63.1)).mul(rim).mul(0.1))
      .add(color(hsl.integer(81, 100, 86)).mul(embers).mul(1.2))
  }
}
