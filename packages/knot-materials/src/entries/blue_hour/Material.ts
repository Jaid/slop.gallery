import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// The cobalt painting sits below the glaze and drifts against its highlights as you walk.
    const q = p.sub(view.mul(0.05))
    const washField = mx_fractal_noise_float(q.mul(1.7).add(vec3(0.3, 0, 0)), 4, 2.1, 0.5).mul(0.5).add(0.5)
    const mountain = washField.smoothstep(0.28, 0.52)
    const wash = washField.smoothstep(0.16, 0.45).mul(0.6)
    const dryBrush = mx_noise_float(q.mul(10)).mul(0.5).add(0.5).smoothstep(0.45, 0.8).mul(0.45)
    const tide = opticalBands(q.y.mul(TAU * 2.5).add(mx_noise_float(q.mul(2)).mul(1.4))).mul(0.35)
    const painting = mountain.mul(0.95).add(wash).add(dryBrush).add(tide).clamp()
    const ink = painting.smoothstep(0.3, 0.85)
    const cobalt = mix(color(hsl.integer(266, 87, 32)), color(hsl.integer(268, 86, 8)), painting)
    const porcelain = mix(color(hsl.integer(88, 20, 60)), color(hsl.integer(88, 23, 48)), mx_noise_float(p.mul(5)).mul(0.5).add(0.5))
    const crazeQ = p.sub(view.mul(0.02))
    const craze = filteredRibbon(cellularBoundary(crazeQ.mul(7)), 0.005).add(filteredRibbon(cellularBoundary(crazeQ.mul(17)), 0.003).mul(near)).clamp()
    const height = painting.mul(0.0028).sub(craze.mul(0.003)).add(mx_noise_float(p.mul(30)).mul(0.0008))
    this.normalNode = proceduralNormal(height, 0.7)
    this.colorNode = mix(mix(porcelain, cobalt, ink), color(hsl.integer(82, 20, 29)), craze.mul(0.45))
    this.metalness = 0
    this.roughnessNode = mix(float(0.06), float(0.14), ink.mul(0.4)).add(craze.mul(0.1))
    this.aoNode = float(1).sub(craze.mul(0.3))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.transmission = 0.22
    this.thickness = 0.35
    this.ior = 1.5
    this.dispersion = 0.08
    this.attenuationColor.set(hsl.integer(84, 46, 79))
    this.attenuationDistance = 1
    this.envMapIntensity = 0.5
// A cloud of afternoon light wanders the glaze, the only thing in the room still moving.
    const dayLight = mx_fractal_noise_float(p.mul(0.9).add(vec3(time.mul(0.03), time.mul(0.012), 0)), 2, 2, 0.5).mul(0.5).add(0.5)
    this.emissiveNode = color(hsl.integer(79, 100, 87)).mul(intimate).mul(dayLight).mul(0.1).add(color(hsl.integer(272, 100, 81)).mul(grazing.pow(3)).mul(0.1))
  }
}
