import type {BufferGeometry} from 'three/webgpu'

import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {CircleGeometry, CylinderGeometry, TorusGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {fountainBench, fountainBenchFrame} from './fountainBenches.ts'

/** Lengthwise teak battens on two smoothly bent steel U-frames, shared by both benches. */
export default class SlattedBenchGeometry {
  readonly metal: BufferGeometry
  readonly wood: BufferGeometry

  constructor() {
    const {width, depth, height, slats, slatGap} = fountainBench
    const pitch = (depth + slatGap) / slats
    const wood: Array<BufferGeometry> = []
    const metal: Array<BufferGeometry> = []
    for (let i = 0; i < slats; i++) {
      const z = (i + 0.5) * pitch - (depth + slatGap) / 2
      // Two smooth-shaded facets per 12 mm round-over stay within 1 mm of the true arc.
      const slat = new RoundedBoxGeometry(width, 0.085, pitch - slatGap, 1, 0.012)
      // Rotate the grain too, along the seat and the long edges of each batten.
      const uv = slat.getAttribute('uv')
      for (let vertex = 0; vertex < uv.count; vertex++) {
        uv.setXY(vertex, uv.getY(vertex), uv.getX(vertex))
      }
      wood.push(slat.translate(0, height - 0.0425, z))
      for (const x of fountainBenchFrame.centers) {
        const screwHead = new CylinderGeometry(0.01, 0.01, 0.003, 8)
        metal.push(screwHead.translate(x, height + 0.001, z))
      }
    }
    const {radius, bendRadius, halfDepth, topY} = fountainBenchFrame
    const straightHeight = topY - bendRadius
    // 24 sides and eight segments per quarter bend keep the silhouette within 1 mm of the tube.
    const sides = 24
    for (const x of fountainBenchFrame.centers) {
      const crossRail = new CylinderGeometry(radius, radius, 2 * (halfDepth - bendRadius), sides, 1, true)
      metal.push(crossRail.rotateX(Math.PI / 2).translate(x, topY, 0))
      for (const side of [-1, 1]) {
        const leg = new CylinderGeometry(radius, radius, straightHeight, sides, 1, true)
        metal.push(leg.translate(x, straightHeight / 2, side * halfDepth))
        // Exact cylindrical/toroidal normals agree at the tangent joins – no averaged bevel normals or internal end caps.
        const shoulder = new TorusGeometry(bendRadius, radius, sides, 8, Math.PI / 2)
        metal.push(shoulder.rotateY(-side * Math.PI / 2).translate(x, straightHeight, side * (halfDepth - bendRadius)))
        const foot = new CircleGeometry(radius, sides)
        metal.push(foot.rotateX(Math.PI / 2).translate(x, 0, side * halfDepth))
      }
    }
    this.wood = mergeParts(wood)
    this.metal = mergeParts(metal)
  }

  dispose() {
    this.wood.dispose()
    this.metal.dispose()
  }
}
