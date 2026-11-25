import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Folded, acid-etched steel with real anisotropic brushing following the layer flow. The watered pattern sits a hair under the polish, so it slides against the highlights as you circle; temper colours bloom at grazing angles, and only up close do the micro brush strokes and a faint forge memory in the seams resolve. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const tube = uv()
    const warp = mx_fractal_noise_float(p.mul(3.8).add(vec3(0, time.mul(0.04), 0)), 3, 2.2, 0.55)
    const fold = p.dot(vec3(0.55, 1, 0.35).normalize()).mul(34).add(warp.mul(7.5)).add(view.x.mul(0.7)).add(time.mul(0.1))
    const layers = fold.sin()
    const bright = layers.smoothstep(-0.3, 0.35)
    const seam = opticalLine(layers, 0.09)
    const watering = fold.mul(3.1).add(warp.mul(4)).sin().mul(0.5).add(0.5)
    const brush = mx_noise_float(vec3(tube.x.mul(26), tube.y.mul(320), 2.5))
    const angle = bright.sub(0.5).mul(1.1).add(watering.sub(0.5).mul(0.4))
    const steel = mix(color(hsl.integer(260, 16, 16)), color(hsl.integer(255, 19, 88)), bright)
    this.colorNode = mix(steel, color(hsl.integer(254, 9, 61)), watering.mul(0.35).mul(bright.oneMinus()))
    this.metalness = 1
    this.roughnessNode = float(0.36).mix(0.09, bright).add(brush.mul(0.05).mul(intimate)).add(seam.mul(0.18))
    this.anisotropy = 1
    this.anisotropyNode = vec2(angle.cos(), angle.sin()).mul(0.85)
    this.iridescence = 1
    this.iridescenceNode = grazing.mul(0.55).mul(bright)
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = bright.mul(180).add(warp.mul(60)).add(300)
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(bright.mul(0.7).add(seam.mul(0.5)), 0.002)
    this.emissiveNode = color(hsl.integer(49, 100, 67.9)).mul(seam).mul(intimate.abs().pow(2)).mul(0.22)
  }
}
