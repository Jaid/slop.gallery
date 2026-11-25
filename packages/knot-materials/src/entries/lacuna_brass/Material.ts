import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, positionGeometry, uv, vec2} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

/** A rounded rectangular punch in a seamless 32 × 8 mechanical music-roll grid. */
function brassPunch(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(32, 8))
  const cell = q.floor().mod(vec2(32, 8))
  const local = q.fract().sub(0.5)
  // A deterministic four-column rhythm, with every fourth row retained as a structural rail.
  const open = cell.x.add(cell.y.mul(3)).mod(4).lessThan(3).and(cell.y.mod(4).lessThan(3))
  const corner = local.abs().sub(vec2(0.22, 0.26))
  const distance = corner.max(0).length().add(corner.x.max(corner.y).min(0)).sub(0.065)
  return {
    distance,
    open,
    q,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {distance, open, q} = brassPunch(uv())
    const footprint = q.fwidth().length().max(0.0001)
    const aperture = distance.smoothstep(footprint.negate(), footprint)
    // Opaque cutouts, not sorted transparent shells. MSAA coverage softens the punched edges.
    this.opacityNode = open.select(aperture, float(1))
    this.alphaTest = 0.5
    this.alphaToCoverage = true
    this.side = DoubleSide
    const rim = distance.abs().smoothstep(0.018, footprint.add(0.045)).oneMinus().mul(open.select(1, 0))
    const rail = q.y.mul(Math.PI / 2).cos().smoothstep(0.94, 0.995)
    const brushPhase = positionGeometry.length().mul(1800)
    const brush = brushPhase.sin().mul(brushPhase.fwidth().smoothstep(0.5, 2).oneMinus())
    const brass = color(hsl.integer(79, 65, 67)).mul(brush.mul(0.035).add(0.95))
    this.colorNode = mix(mix(brass, color(hsl.integer(204, 69, 32)), rail), color(hsl.integer(83, 75, 86.5)), rim.mul(0.7))
    this.metalnessNode = mix(float(0.9), float(0.25), rail)
    this.roughnessNode = float(0.31).add(rail.mul(0.12)).sub(rim.mul(0.09))
    this.anisotropy = 0.45
    this.anisotropyNode = vec2(1, 0).mul(0.45)
    this.normalNode = proceduralNormal(rim.mul(0.0007).add(brush.mul(0.000015)), 1)
  }
}
