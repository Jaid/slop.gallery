import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_cell_noise_float, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 8. TESSERACT MATRIX 4D non-Euclidean manifold disguised as an obsidian mirror knot. High grazing angles form a sleek liquid chromium reflection, but looking inward unveils an infinite abyss populated by 4 recursive hypercube neon lattice planes rotating in 4D space. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near} = viewerFrame()
    this.colorNode = color(hsl.integer(241, 29, 3))
    this.metalnessNode = grazing.pow(1.4).mul(0.95)
    this.roughnessNode = grazing.oneMinus().mul(0.04).add(0.01)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // 4 Recursive Interior Depth Layers (Pseudo-volumetric ray-projected lattice)
    const depths = [0.12, 0.25, 0.42, 0.65]
    const colors = [color(hsl.integer(200, 100, 86)), color(hsl.integer(3, 100, 58.7)), color(hsl.integer(80, 100, 79.7)), color(hsl.integer(306, 81, 52))]
    let innerGrid: Node<'vec3'> = vec3(0)
    for (const [i, d] of depths.entries()) {
      const col = colors[i]
      const posInner = p.sub(view.mul(d))
      const angle = time.mul(0.14 * (i + 1))
      const cosA = angle.cos()
      const sinA = angle.sin()
      const rotX = posInner.x.mul(cosA).sub(posInner.z.mul(sinA))
      const rotZ = posInner.x.mul(sinA).add(posInner.z.mul(cosA))
      const q = vec3(rotX, posInner.y.add(time.mul(0.035 * (i % 2 === 0 ? 1 : -1))), rotZ).mul(13 + i * 5)
      const gx = opticalLine(q.x.fract().sub(0.5), 0.05)
      const gy = opticalLine(q.y.fract().sub(0.5), 0.05)
      const gz = opticalLine(q.z.fract().sub(0.5), 0.05)
      const grid = gx.max(gy).max(gz)
      const attenuation = 1 / (1 + i * 0.65)
      innerGrid = innerGrid.add(col.mul(grid).mul(attenuation))
    }
    // Cyber telemetry scanlines flickering across grazing views
    const tick = time.mul(8).floor()
    const telemetry = mx_cell_noise_float(vec3(p.y.mul(26), tick, 1.5)).smoothstep(0.91, 0.96)
    const innerVoid = innerGrid.mul(facing.pow(0.7)).mul(2.4)
    const telemetryGlow = color(hsl.integer(200, 100, 86)).mul(telemetry).mul(1.6)
    this.emissiveNode = innerVoid.add(telemetryGlow).mul(near.mul(0.6).add(0.5)).add(color(hsl.integer(3, 100, 58.7)).mul(rim).mul(0.25))
  }
}
