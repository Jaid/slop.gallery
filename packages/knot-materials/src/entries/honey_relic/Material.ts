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
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const orbit = view.x.mul(0.55).add(view.y.mul(0.35)).add(0.5)
    const comb = inner.mul(vec3(10, 3.2, 10))
    const cells = mx_noise_float(comb).mul(0.5).add(0.5)
    const walls = opticalLine(comb.x.sin().mul(comb.z.sin()).add(comb.y.cos().mul(0.55)), 0.04)
    const pollen = opticalLine(mx_noise_float(deep.mul(26).add(vec3(time.mul(0.08), 0, time.mul(-0.05)))), 0.02)
    const sunshaft = facing.pow(2.6).mul(orbit.mul(0.45).add(0.55))
    this.colorNode = mix(color(hsl.integer(52, 89, 34)), color(hsl.integer(88, 100, 87)), cells)
    this.transmission = 0.7
    this.thickness = 0.5
    this.ior = 1.54
    this.dispersion = 0.28
    this.attenuationColor.set(hsl.integer(56, 92, 55.6))
    this.attenuationDistance = 0.62
    this.roughnessNode = walls.mul(0.05).add(0.055)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)), 0.0014)
    this.clearcoat = 0.72
    this.clearcoatRoughness = 0.06
    this.emissiveNode = color(hsl.integer(63.5, 100, 73.7)).mul(walls).mul(near.mul(0.5).add(0.26)).add(color(hsl.integer(96, 100, 95.4)).mul(pollen).mul(cells.pow(2)).mul(near.mul(1.1).add(0.15))).add(color(hsl.integer(83, 100, 85.4)).mul(sunshaft).mul(0.16)).add(color(hsl.integer(45, 98, 55)).mul(rim).mul(0.1))
  }
}
