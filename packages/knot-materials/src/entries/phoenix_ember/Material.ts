import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
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
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // Charred crust over a slow-breathing heart of coals; the seams vent
    // fire on the inhale and the silhouette smoulders at grazing angles.
    const char = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const cracks = filament(mx_noise_float(p.mul(5).add(mx_noise_vec3(p.mul(9)).mul(0.4))), 0.02)
    const coals = mx_noise_float(inner.mul(10).add(vec3(0, time.mul(0.04), 0))).mul(0.5).add(0.5)
    const breath = time.mul(0.6).sin().mul(0.5).add(0.5).pow(2)
    const feathers = opticalLine(mx_noise_float(deep.mul(19)), 0.024).mul(near)
    this.colorNode = mix(color(hsl.integer(27, 32, 6)), color(hsl.integer(33, 61, 15)), char)
    this.transmission = 0.25
    this.thickness = 0.45
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(35, 100, 29))
    this.attenuationDistance = 0.5
    this.roughnessNode = char.mul(0.25).add(0.3)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(10)), 0.004)
    this.emissiveNode = mix(color(hsl.integer(32, 100, 58.5)), color(hsl.integer(80.4, 100, 82.4)), coals).mul(cracks).mul(breath.mul(0.7).add(0.45)).add(color(hsl.integer(51, 100, 71)).mul(feathers).mul(breath.mul(0.6).add(0.3))).add(color(hsl.integer(38, 100, 63)).mul(grazing.pow(3)).mul(breath.mul(0.3).add(0.1)))
  }
}
