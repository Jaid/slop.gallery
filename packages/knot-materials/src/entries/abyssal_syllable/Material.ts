import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.7
    const {p, facing, rim, near, intimate} = viewerFrame()
    const drift = vec3(time.mul(0.02), time.mul(0.015), time.mul(-0.01))
    const bodyNoise = mx_fractal_noise_float(p.mul(5).add(drift), 3, 2, 0.5)
    const veinField = mx_noise_float(p.mul(18).add(bodyNoise.mul(2)).sub(drift.mul(2)))
    const vein = opticalLine(veinField.mul(24).sin(), 0.025)
    // Confine each bioluminescent spot to a soft round core, not an entire noise cell.
    const spots = cellularPoints(p.mul(30).add(time.mul(0.03)), 0.06, 0.24, 0.86)
    const pulse = time.mul(0.8).add(bodyNoise.mul(4)).sin().mul(0.5).add(0.5)
    const flesh = mix(color(hsl.integer(216, 71, 7)), color(hsl.integer(195, 82, 28)), bodyNoise.mul(0.5).add(0.5))
    this.colorNode = flesh
    this.transmission = 0.6
    this.thickness = 0.5
    this.ior = 1.38
    this.attenuationColor.set(hsl.integer(195, 80, 22))
    this.attenuationDistance = 0.6
    this.roughness = 0.15
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.1
    this.normalNode = liquidNormal(near, 0.15)
    this.emissiveNode = mix(color(hsl.integer(176, 98, 85)), color(hsl.integer(182, 99, 94)), pulse).mul(vein).mul(1.8).mul(near.mul(0.5).add(0.5)).add(color(hsl.integer(338, 100, 67)).mul(spots).mul(pulse).mul(intimate.mul(0.8).add(0.3))).add(color(hsl.integer(195, 100, 89.9)).mul(rim).mul(0.2)).add(color(hsl.integer(176, 98, 85)).mul(facing).mul(0.05))
  }
}
