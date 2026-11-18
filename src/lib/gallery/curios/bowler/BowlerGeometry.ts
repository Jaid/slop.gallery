import type {BufferGeometry} from 'three/webgpu'

import {LatheGeometry, Vector2} from 'three/webgpu'

import {mergeParts} from '../../../geometry.ts'

/** An oval of revolution about the crown’s upright axis, in meters above the lid. */
function oval(profile: ReadonlyArray<readonly [number, number]>) {
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 64)
  return geometry.scale(1, 1, 1.08)
}

/** A black felt bowler, blocked into a rounded crown with a side-curled brim and a fitted satin ribbon. */
export default class BowlerGeometry {
  readonly felt: BufferGeometry
  readonly ribbon: BufferGeometry

  constructor() {
    const crown = oval([[0.145, 0.004], [0.145, 0.025], [0.143, 0.065], [0.141, 0.103], [0.137, 0.145], [0.13, 0.17], [0.12, 0.19], [0.106, 0.206], [0.087, 0.218], [0.065, 0.225], [0.035, 0.23], [0, 0.231]])
    // Turn the brim out from the crown, around its bound lip and back along the upper face.
    const brim = oval([[0.136, 0], [0.151, 0.001], [0.17, 0.003], [0.189, 0.007], [0.2, 0.012], [0.204, 0.016], [0.204, 0.02], [0.201, 0.022], [0.198, 0.018], [0.188, 0.012], [0.17, 0.009], [0.15, 0.007], [0.136, 0.006]])
    const vertices = brim.getAttribute('position')
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i)
      const radius = Math.hypot(x, vertices.getZ(i) / 1.08)
      // The sides sweep up like the reference; the front and back sit low on the lid.
      const curl = Math.max(0, (radius - 0.145) / 0.059) ** 2 * (x / radius) ** 2
      vertices.setY(i, vertices.getY(i) + 0.045 * curl)
    }
    brim.computeVertexNormals()
    this.felt = mergeParts([crown, brim])
    this.ribbon = oval([[0.144, 0.021], [0.147, 0.022], [0.147, 0.025], [0.145, 0.059], [0.1445, 0.062], [0.142, 0.063]])
  }

  dispose() {
    this.felt.dispose()
    this.ribbon.dispose()
  }
}
