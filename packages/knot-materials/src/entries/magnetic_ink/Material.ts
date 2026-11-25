import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
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
    const crawl = mx_noise_vec3(inner.mul(4.5).add(vec3(0, time.mul(0.02), 0))).mul(0.55)
    const ridge = mx_noise_float(inner.mul(8).add(crawl)).abs().oneMinus().pow(3)
    // Relief answers the viewer: spikes rise toward grazing angles and close range.
    const magnet = grazing.mul(1.5).add(0.35).mul(near.mul(1.3).add(0.5))
    this.colorNode = mix(color(hsl.integer(273, 28, 4)), color(hsl.integer(270, 39, 12)), noise)
    this.metalness = 1
    this.roughnessNode = magnet.mul(0.02).add(0.035)
    this.clearcoat = 0.75
    this.clearcoatRoughness = 0.028
    this.normalNode = proceduralNormal(ridge.mul(magnet), 0.006)
    this.emissiveNode = color(hsl.integer(289, 100, 66)).mul(ridge.pow(2)).mul(magnet).mul(0.4).add(color(hsl.integer(289, 64, 26)).mul(rim).mul(0.28))
    this.envMapIntensity = 1.25
  }
}
