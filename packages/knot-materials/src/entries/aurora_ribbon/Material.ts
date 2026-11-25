import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
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
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // Curtains bend around the viewer: band phase includes view.x, and the
    // glow leans on grazing, so the veil ignites when seen edge-on.
    const warp = mx_noise_vec3(inner.mul(4).add(vec3(0, time.mul(0.06), 0)))
    const curtain = inner.x.mul(6).add(warp.y.mul(3)).add(time.mul(0.1))
    const veil = curtain.sin().mul(0.5).add(0.5).pow(2)
    const bands = spectralColor(curtain.add(view.x.mul(2.2)))
    const shimmer = opticalLine(mx_noise_float(deep.mul(16).add(warp)), 0.03)
    this.colorNode = mix(color(hsl.integer(236, 71, 13)), color(hsl.integer(215, 79, 22)), veil)
    this.transmission = 0.5
    this.thickness = 0.44
    this.ior = 1.42
    this.dispersion = 0.3
    this.attenuationColor.set(hsl.integer(211, 90, 32))
    this.attenuationDistance = 0.7
    this.roughness = 0.12
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.05
    this.iridescence = 0.9
    this.iridescenceIOR = 1.3
    this.normalNode = liquidNormal(near, 0.22)
    this.emissiveNode = bands.mul(veil).mul(grazing.mul(0.7).add(0.3)).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(207, 100, 93)).mul(shimmer).mul(near).mul(0.5)).add(color(hsl.integer(164, 91, 83)).mul(rim).mul(0.18))
  }
}
