import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
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
    // Two buried, curved lens planes slide independently as the observer moves.
    const lens = inner.xz.length().add(inner.y.mul(0.28))
    const warpedRadius = lens.add(lens.mul(9).sub(time.mul(0.12)).sin().mul(0.035))
    const rings = opticalLine(warpedRadius.mul(70).sin(), 0.085)
    const echo = opticalLine(deep.xz.length().add(deep.y.mul(0.2)).mul(95).sin(), 0.065)
    const disk = inner.y.add(inner.x.mul(0.45)).abs().smoothstep(0.04, 0.32).oneMinus()
    const orbit = mix(color(hsl.integer(224, 89, 71)), color(hsl.integer(70, 100, 82.6)), view.x.mul(0.6).add(0.5).clamp())
    this.colorNode = mix(color(hsl.integer(261, 44, 4)), color(hsl.integer(265, 40, 15)), rim)
    this.metalness = 0.82
    this.roughnessNode = near.mul(-0.025).add(0.13)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.emissiveNode = orbit.mul(rings).mul(disk.mul(0.85).add(0.12)).mul(near.mul(0.65).add(0.45)).add(color(hsl.integer(271, 72, 55)).mul(echo).mul(near).mul(disk.oneMinus()).mul(0.3)).add(color(hsl.integer(70, 69, 79)).mul(rim.pow(2)).mul(0.22))
  }
}
