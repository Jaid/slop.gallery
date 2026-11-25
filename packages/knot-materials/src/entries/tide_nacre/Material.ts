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
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.7, 2.4).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const orbit = view.x.mul(0.55).add(view.y.mul(0.35)).add(0.5)
    const glance = grazing.pow(2.4)
    const swell = inner.mul(vec3(6.2, 3.4, 6.2)).add(vec3(0, time.mul(0.07), time.mul(-0.04)))
    const chambers = mx_noise_float(swell).mul(0.5).add(0.5)
    const ridges = opticalLine(swell.x.sin().mul(swell.z.cos()).add(swell.y.mul(1.8)), 0.042)
    const echo = opticalLine(mx_noise_float(deep.mul(9)).mul(36).sin(), 0.05)
    const walk = spectralColor(chambers.mul(6.4).add(view.x.mul(5.2)).add(view.y.mul(3.1)).add(time.mul(0.11)))
    const foil = spectralColor(chambers.mul(6.4).add(2.0944).add(orbit.mul(2)))
    const grooves = opticalBands(p.y.mul(148).add(p.x.mul(22))).mul(near)
    this.colorNode = mix(mix(color(hsl.integer(223, 57, 21)), color(hsl.integer(176, 100, 96.4)), chambers.mul(0.45)), walk, ridges.mul(0.55).add(0.2))
    this.metalness = 0.38
    this.roughnessNode = grooves.mul(0.05).add(ridges.mul(0.04)).add(0.11)
    this.iridescence = 1
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = chambers.mul(180).add(orbit.mul(220)).add(280)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.normalNode = liquidNormal(near.mul(0.65).add(0.2), 0.11)
    this.sheen = 0.85
    this.sheenNode = mix(color(hsl.integer(180, 78, 90)), foil, glance)
    this.sheenRoughness = 0.22
    this.emissiveNode = walk.mul(ridges).mul(near.mul(0.6).add(0.22)).add(foil.mul(echo).mul(intimate).mul(0.4)).add(color(hsl.integer(185, 100, 95)).mul(rim).mul(0.12))
  }
}
