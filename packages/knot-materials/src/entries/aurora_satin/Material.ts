import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const drift = vec3(time.mul(0.05), time.mul(-0.03), 0)
    const veil = mx_noise_float(inner.mul(3).add(drift))
    const curtain = opticalBands(veil.mul(18).add(p.y.mul(6)).sub(time.mul(0.4)))
    const shimmer = spectralColor(veil.mul(4).add(view.y.mul(3)).add(time.mul(0.12)))
    const distant = opticalLine(mx_noise_float(deep.mul(9).sub(drift)), 0.03)
    this.colorNode = mix(color(hsl.integer(258, 54, 11)), color(hsl.integer(255, 52, 22)), veil.mul(0.5).add(0.5))
    this.transmission = 0.55
    this.thickness = 0.4
    this.ior = 1.32
    this.dispersion = 0.15
    this.attenuationColor.set(hsl.integer(256, 70, 21))
    this.attenuationDistance = 0.9
    this.roughness = 0.06
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.05
    this.normalNode = liquidNormal(near, 0.1)
    // Curtain hue drifts slowly and rotates with the viewer, like real aurora parallax.
    this.emissiveNode = shimmer.mul(curtain).mul(near.mul(0.6).add(0.5)).add(color(hsl.integer(170, 63, 91.3)).mul(distant).mul(near).mul(0.4)).add(color(hsl.integer(233, 100, 82.3)).mul(rim).mul(0.18))
  }
}
