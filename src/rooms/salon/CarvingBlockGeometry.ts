import type {Vec3} from 'math'

import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js'
import {BoxGeometry} from 'three/webgpu'

/** The faces stay sawn flat; only the exposed edges lose small, irregular chips. */
export default class CarvingBlockGeometry extends BoxGeometry {
  constructor([width, height, depth]: Vec3) {
    super(width, height, depth, Math.ceil(width / 0.035), Math.ceil(height / 0.035), Math.ceil(depth / 0.035))
    const vertices = this.getAttribute('position')
    const noise = new ImprovedNoise
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i)
      const y = vertices.getY(i)
      const z = vertices.getZ(i)
      const edgeX = Math.abs(x) > width / 2 - 0.00001
      const edgeY = Math.abs(y) > height / 2 - 0.00001
      const edgeZ = Math.abs(z) > depth / 2 - 0.00001
      if (Number(edgeX) + Number(edgeY) + Number(edgeZ) < 2) {
        continue
      }
      // Sample the cut by position, so both faces of each edge lose exactly the same chip.
      const nick = 0.003 + 0.025 * Math.max(0, noise.noise(x * 17 + 2.7, y * 17, z * 17))
      vertices.setXYZ(i, x - (edgeX ? Math.sign(x) * nick : 0), y - (edgeY ? Math.sign(y) * nick : 0), z - (edgeZ ? Math.sign(z) * nick : 0))
    }
    this.computeVertexNormals()
  }
}
