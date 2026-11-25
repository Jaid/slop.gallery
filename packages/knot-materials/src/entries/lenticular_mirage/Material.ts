import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, positionGeometry, positionView, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const topography = mx_noise_float(inner.mul(5)).add(inner.y.mul(0.5))
    const contours = opticalLine(topography.mul(32).sin(), 0.06)
    const echo = opticalLine(mx_noise_float(deep.mul(7)).mul(40).sin(), 0.055)
    const foil = spectralColor(topography.mul(7).add(view.x.mul(6)).add(view.y.mul(3)))
    const grooves = opticalBands(p.y.mul(160)).mul(near)
    this.colorNode = mix(color(hsl.integer(236, 55, 23)), foil, contours.mul(0.35).add(0.25))
    this.metalness = 0.7
    this.roughnessNode = grooves.mul(0.045).add(0.17)
    this.iridescence = 1
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = topography.mul(100).add(360)
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.055
    this.emissiveNode = foil.mul(contours).mul(near.mul(0.55).add(0.25)).add(spectralColor(topography.mul(7).add(3)).mul(echo).mul(near).mul(0.35))
  }
}
