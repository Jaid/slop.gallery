import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

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
    // Flux rings pinned inside a mirror shell; they hold their world position
    // while a fine vortex lattice only resolves within arm's reach.
    const field = inner.length().mul(14)
    const fluxRings = opticalLine(field.sin(), 0.09)
    const lattice = opticalLine(mx_noise_float(deep.mul(28)), 0.02).mul(near)
    const levitate = time.mul(0.5).sin().mul(0.5).add(0.5)
    const cold = mix(color(hsl.integer(232, 100, 80.4)), color(hsl.integer(212, 100, 97)), facing.pow(2))
    this.colorNode = mix(color(hsl.integer(256, 30, 7.5)), color(hsl.integer(244, 40, 23)), fluxRings.mul(0.6))
    this.metalness = 0.9
    this.roughnessNode = near.mul(-0.02).add(0.09)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.6
    this.iridescenceIOR = 1.28
    this.emissiveNode = cold.mul(fluxRings).mul(levitate.mul(0.25).add(0.6)).mul(near.mul(0.5).add(0.4)).add(color(hsl.integer(229, 100, 90)).mul(lattice).mul(0.9)).add(color(hsl.integer(244, 100, 72)).mul(rim.pow(2)).mul(0.35))
  }
}
