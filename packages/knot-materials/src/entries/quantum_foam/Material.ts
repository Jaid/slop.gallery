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
    // Vacuum froth: a churning film of subatomic bubbles. The spectral
    // palette is swept by an object-space view phase, so the surface cycles
    // through the visible spectrum as the visitor pans across it.
    const foam = mx_noise_float(inner.mul(36).add(time.mul(0.55))).mul(0.5).add(0.5)
    const bubble = opticalLine(foam.mul(2).sub(1), 0.05)
    const froth = mx_noise_float(deep.mul(72).sub(time.mul(0.85))).mul(0.5).add(0.5)
    const flicker = opticalLine(froth.mul(2).sub(1), 0.06)
    const phase = inner.x.add(inner.y).add(inner.z).add(view.x.mul(2.5)).add(view.y.mul(1.5)).add(time.mul(0.18)).mul(0.5)
    this.colorNode = mix(color(hsl.integer(288, 78, 10)), color(hsl.integer(284, 85, 42.6)), foam.mul(0.65))
    this.metalnessNode = foam.mul(0.65)
    this.roughnessNode = foam.mul(0.16).add(0.05)
    this.iridescence = 1
    this.iridescenceIOR = 1.75
    this.iridescenceThicknessNode = foam.mul(420).add(180)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.emissiveNode = spectralColor(phase).mul(bubble).mul(near.mul(0.7).add(0.15)).add(color(hsl.integer(296, 100, 75)).mul(flicker).mul(near).mul(0.65)).add(color(hsl.integer(289, 100, 56.4)).mul(rim).mul(0.28))
  }
}
