import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
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
    // Object-space direction from the surface point to the camera. Drives every
    // angular reaction in this file (parallax, hue shift, fresnel tinting).
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance — fine/deep layers fade in continuously on approach,
    // their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // A waterfall of refracted spectrum. The rainbow phase is anchored to
    // both the surface's vertical coordinate and the object-space view
    // vector, so colours pour down the knot and slide laterally as the
    // visitor circles it.
    const flow = inner.y.mul(3.2).sub(time.mul(0.4))
    const strata = opticalLine(flow.add(mx_noise_float(inner.mul(7)).mul(1.4)).sin(), 0.05)
    const bands = opticalLine(mx_noise_float(deep.mul(22).add(time.mul(0.2))).mul(2).sub(1), 0.04)
    const groove = mx_noise_float(p.mul(70)).mul(0.5).add(0.5)
    const rainbow = spectralColor(inner.y.mul(1.7).add(view.x.mul(1.4)).add(view.y.mul(0.6)).add(time.mul(0.05)).add(0.35))
    this.colorNode = mix(color(hsl.integer(292, 52, 11)), rainbow, strata.mul(0.4).add(0.2))
    this.metalness = 0.6
    this.roughnessNode = groove.mul(0.06).add(0.09)
    this.iridescence = 1
    this.iridescenceIOR = 1.65
    this.iridescenceThicknessNode = inner.y.mul(340).add(280)
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.04
    this.emissiveNode = rainbow.mul(strata).mul(near.mul(0.6).add(0.3)).add(spectralColor(inner.y.mul(2).add(view.x.mul(2)).add(2.2)).mul(bands).mul(near).mul(0.5)).add(rainbow.mul(rim).mul(0.24))
  }
}
