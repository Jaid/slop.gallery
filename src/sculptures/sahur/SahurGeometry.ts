import type {Hull} from './lib/meshBuilder.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {buildEyeballs, buildEyebrows, buildEyelids, buildHeadTorso} from './lib/faceSculpt.ts'
import {buildLimbsAndBat} from './lib/limbs.ts'
import {MeshBuilder} from './lib/meshBuilder.ts'

/** Single indexed carving-stone sculpture of Tung Tung Tung Sahur, standing on flat bare feet and his leaning baseball bat at y = 0. */
export default class SahurGeometry extends BufferGeometry {
  readonly hulls: Array<Hull>
  constructor() {
    super()
    const mesh = new MeshBuilder
    const hulls: Array<Hull> = [
      ...buildHeadTorso(mesh),
      ...buildLimbsAndBat(mesh),
    ]
    buildEyeballs(mesh)
    buildEyelids(mesh)
    buildEyebrows(mesh)
    const totalWeight = hulls.reduce((sum, hull) => sum + hull.share, 0)
    for (const hull of hulls) {
      hull.share /= totalWeight
    }
    this.setIndex(mesh.indices)
    this.setAttribute('position', new Float32BufferAttribute(mesh.positions, 3))
    this.computeVertexNormals()
    this.hulls = hulls
  }
}
