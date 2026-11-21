import type {Hull, Ring} from './SahurMesh.ts'

import {BufferGeometry} from 'three/webgpu'

import {carveLog, inlayEyes} from './carving.ts'
import {carveFigure} from './figure.ts'
import SahurMesh from './SahurMesh.ts'

/** One indexed display mesh and a compound collider, both sampled from the same carving. */
export default class TungTungTungSahurGeometry extends BufferGeometry {
  readonly hulls: ReadonlyArray<Hull>

  constructor() {
    super()
    const mesh = new SahurMesh
    const hulls: Array<Hull> = []
    // Approximate solid-wood mass per blank, in kilograms. The body dominates the center of mass.
    const addHull = (rings: ReadonlyArray<Ring>, weight: number, stride?: number) => {
      hulls.push({
        points: new Float32Array(mesh.hull(rings, stride)),
        share: weight,
      })
    }
    const log = carveLog(mesh)
    const split = 25 // overlap waist and head colliders at the join
    addHull(log.slice(0, split + 2), 209, 3)
    addHull(log.slice(split), 232, 3)
    inlayEyes(mesh)
    carveFigure(mesh, addHull)
    mesh.writeTo(this)
    const total = hulls.reduce((sum, hull) => sum + hull.share, 0)
    this.hulls = hulls.map(({points, share}) => ({
      points,
      share: share / total,
    }))
  }
}
