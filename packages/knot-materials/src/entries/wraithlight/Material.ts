import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    // Object-space direction from the surface point to the camera. Drives every
    // angular reaction in this file (parallax, hue shift, fresnel tinting).
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance — fine/deep layers fade in continuously on approach,
    // their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // Haunted, near-transparent glass. A grazing fresnel veil means the knot
    // visibly materialises at the silhouette as the visitor skirts around
    // it, then fades to a faint interior mist head-on.
    const mist = mx_noise_float(inner.mul(5).add(vec3(0, time.mul(-0.05), time.mul(0.035)))).mul(0.5).add(0.5)
    const tendril = filament(mx_noise_float(inner.mul(9).add(mx_noise_vec3(inner.mul(3.5)).mul(0.55))), 0.022)
    const veil = opticalLine(mx_noise_float(deep.mul(6).add(time.mul(0.03))).mul(2).sub(1), 0.05)
    const cold = mix(color(hsl.integer(249, 42, 9)), color(hsl.integer(248, 28, 50)), mist.pow(1.4))
    const ghost = color(hsl.integer(223, 100, 92))
    this.colorNode = mix(color(hsl.integer(251, 43, 5)), cold, mist.mul(grazing.mul(0.4).add(0.3)))
    this.transmission = 0.62
    this.thickness = 0.5
    this.ior = 1.35
    this.attenuationColor.set(hsl.integer(245, 43, 38))
    this.attenuationDistance = 0.9
    this.roughnessNode = mist.mul(0.05).add(0.2)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.08
    this.normalNode = liquidNormal(near, 0.1)
    this.emissiveNode = ghost.mul(tendril).mul(near.mul(0.6).add(0.15)).mul(grazing.mul(0.5).add(0.3)).add(ghost.mul(rim).mul(0.5)).add(color(hsl.integer(256, 100, 76)).mul(veil).mul(near).mul(0.35)).add(color(hsl.integer(248, 52, 63.6)).mul(mist.pow(4)).mul(0.25))
  }
}
