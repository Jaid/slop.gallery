import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const wind = mx_noise_float(vec3(inner.x.mul(0.5), inner.y.mul(0.08).sub(time.mul(0.11)), inner.z.mul(0.5)))
    const columns = inner.x.mul(14).add(inner.z.mul(8)).add(wind.mul(2.2))
    const streaks = opticalLine(columns.fract().sub(0.5), 0.075)
    // Each streak picks its own fall speed from the column it lives in.
    const speed = mx_noise_float(vec3(columns.floor().mul(0.43), 8.8, 1.2)).mul(0.9).add(1.1)
    const drops = inner.y.mul(7).add(time.mul(speed)).sin().mul(0.5).add(0.5).pow(24)
    const rain = streaks.mul(drops.mul(0.85).add(0.2))
    const mist = opticalLine(mx_noise_float(deep.mul(30)), 0.02)
    this.colorNode = mix(color(hsl.integer(257, 22, 9)), color(hsl.integer(246, 23, 21)), noise)
    this.transmission = 0.55
    this.thickness = 0.46
    this.ior = 1.5
    this.dispersion = 0.24
    this.attenuationColor.set(hsl.integer(244, 48, 12))
    this.attenuationDistance = 0.5
    this.roughnessNode = rain.mul(-0.05).add(0.09)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(rain, 0.0011)
    this.emissiveNode = color(hsl.integer(244, 100, 82)).mul(rain).mul(grazing.mul(0.55).add(0.45)).mul(near.mul(0.5).add(0.3)).add(color(hsl.integer(245, 100, 94)).mul(mist).mul(near).mul(0.85)).add(color(hsl.integer(249, 36, 46)).mul(rim).mul(0.12))
  }
}
