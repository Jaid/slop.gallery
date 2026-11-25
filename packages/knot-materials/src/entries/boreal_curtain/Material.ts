import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

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
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const drift = vec3(time.mul(0.085), 0, time.mul(-0.032))
    const fold = mx_noise_float(inner.mul(1.9).add(drift))
    const sheets = opticalLine(fold, 0.16)
    const rays = opticalLine(inner.y.mul(31.4).add(fold.mul(9)).sin(), 0.3)
    const echo = opticalLine(mx_noise_float(deep.mul(1.6).add(drift)), 0.12)
    const profile = inner.y.mul(-1.2).add(0.85).clamp()
    const curtain = sheets.mul(rays.mul(0.85).add(0.3)).mul(profile)
    // Lateral position swaps which heights burn green and which burn violet.
    const hue = mix(color(hsl.integer(157.4, 100, 87.2)), color(hsl.integer(287, 100, 61)), inner.y.mul(0.85).add(view.x.mul(0.4)).add(0.55).clamp())
    this.color.set(hsl.integer(254, 42, 9))
    this.transmission = 0.82
    this.thickness = 0.5
    this.ior = 1.52
    this.dispersion = 0.16
    this.attenuationColor.set(hsl.integer(225, 69, 20))
    this.attenuationDistance = 0.9
    this.roughness = 0.04
    this.clearcoat = 0.55
    this.clearcoatRoughness = 0.05
    this.normalNode = liquidNormal(near.mul(0.6), 0.07)
    this.emissiveNode = hue.mul(curtain).mul(near.mul(0.7).add(0.35)).add(color(hsl.integer(332, 100, 95)).mul(rays).mul(sheets).mul(profile).mul(near).mul(0.4)).add(color(hsl.integer(266, 100, 61)).mul(echo).mul(profile).mul(near).mul(0.3)).add(color(hsl.integer(190, 62, 42)).mul(rim).mul(0.1))
  }
}
