import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const columns = inner.x.mul(9).add(inner.z.mul(5.5))
    const columnId = columns.floor()
    const active = mx_noise_float(vec3(columnId.mul(0.37), 4.2, 8.7)).mul(0.5).add(0.62).clamp()
    const speed = mx_noise_float(vec3(columnId.mul(0.43), 8.8, 1.2)).mul(0.9).add(1.1)
    const grains = inner.y.mul(6).add(time.mul(speed)).sin().mul(0.5).add(0.5).pow(28)
    // The sand level breathes on a ~2.5 minute tide; streams die into the pool.
    const level = time.mul(0.045).sin().mul(0.5).add(0.5)
    const floorLine = level.mul(0.62).sub(0.62)
    const air = inner.y.sub(floorLine).mul(3).clamp().add(0.08)
    const streams = opticalLine(columns.fract().sub(0.5), 0.09).mul(active).mul(air)
    const pool = floorLine.sub(inner.y).mul(6).clamp()
    const meniscus = opticalLine(inner.y.sub(floorLine), 0.045)
    const sparkle = view.dot(vec3(0.55, 0.8, 0.25).normalize()).abs().pow(9)
    const sand = mix(color(hsl.integer(68, 100, 79.7)), color(hsl.integer(90, 100, 95.6)), grains)
    this.color.set(hsl.integer(244, 27, 93))
    this.transmission = 0.85
    this.thickness = 0.35
    this.ior = 1.52
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(60, 70, 37))
    this.attenuationDistance = 0.85
    this.roughness = 0.045
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.04
    this.emissiveNode = sand.mul(streams).mul(grains.mul(0.85).add(0.25)).mul(facing.mul(0.3).add(0.7)).mul(near.mul(0.55).add(0.3)).add(color(hsl.integer(51, 87, 55.5)).mul(pool).mul(near.mul(0.65).add(0.3)).mul(0.8)).add(color(hsl.integer(78, 100, 89)).mul(meniscus).mul(near).mul(0.9)).add(color(hsl.integer(93, 100, 97)).mul(streams).mul(sparkle).mul(near).mul(1.3))
  }
}
