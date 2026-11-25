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
    // A living crystalline colony. The polyps shift their bioluminescent hue
    // with a parallax term built from view.x / view.y, so each position on
    // the knot reads as a slightly different species as the visitor moves.
    const polyp = mx_noise_float(inner.mul(11)).mul(0.5).add(0.5)
    const polypFine = opticalLine(mx_noise_float(inner.mul(26)).mul(0.7).add(0.3), 0.04)
    const spores = opticalLine(mx_noise_float(deep.mul(30).add(time.mul(0.15))).mul(0.6).add(0.4), 0.03)
    const hue = polyp.mul(0.6).add(view.x.mul(0.9)).add(view.y.mul(0.5)).add(0.2)
    const reef = spectralColor(hue)
    const coral = mix(color(hsl.integer(308, 70, 14)), color(hsl.integer(344, 100, 68)), polyp.pow(1.4))
    this.colorNode = mix(color(hsl.integer(314, 72, 7)), coral, polyp.mul(0.55).add(0.2))
    this.metalness = 0.32
    this.roughnessNode = polyp.mul(0.22).add(0.14)
    this.iridescence = 0.9
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = polyp.mul(240).add(260)
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.06
    this.emissiveNode = reef.mul(spores).mul(near.mul(0.85).add(0.3)).add(color(hsl.integer(344, 100, 68)).mul(polypFine).mul(near.mul(0.75).add(0.15))).add(color(hsl.integer(293, 100, 52.6)).mul(polyp.pow(3)).mul(0.25)).add(spectralColor(view.x.mul(1.6).add(0.4)).mul(rim).mul(0.22))
  }
}
