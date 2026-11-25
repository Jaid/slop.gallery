import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, modelWorldMatrixInverse, positionGeometry, positionView, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

const lattice = (q: Node<'vec3'>) => {
  const cell = vec3(q.x.add(q.y), q.y.add(q.z), q.z.add(q.x)).mul(24).sin()
  return vec3(filament(cell.x, 0.028), filament(cell.y, 0.028), filament(cell.z, 0.028))
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const depth = p.sub(view.mul(0.085))
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const front = lattice(depth)
    const back = lattice(deep)
    const nodes = front.x.mul(front.y).add(front.y.mul(front.z)).add(front.z.mul(front.x))
    const pulse = inner.y.mul(14).sub(time.mul(1.5)).sin().mul(0.5).add(0.5).pow(8)
    this.color.set(hsl.integer(240, 53, 21))
    this.transmission = 0.72
    this.thickness = 0.4
    this.ior = 1.45
    this.roughness = 0.055
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.07
    this.emissiveNode = color(hsl.integer(191, 94.6, 81)).mul(front.x.max(front.y).max(front.z)).mul(near.mul(0.7).add(0.25)).add(color(hsl.integer(287, 92, 48)).mul(back.x.max(back.y).max(back.z)).mul(near).mul(0.55)).add(color(hsl.integer(164, 100, 97)).mul(nodes).mul(pulse).mul(near.mul(1.2).add(0.2)))
  }
}
