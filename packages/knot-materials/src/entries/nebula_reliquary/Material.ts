import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black glass sealing a genuine volume of gas: the interior is ray-marched along your line of sight, so the filaments have true depth and drift past one another as you circle. Deeper samples shift hue, the tube core glows brightest, and tiny embers ignite in the depths only when you lean in. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const dir = view.negate()
    const chord = facing.mul(0.24).add(0.03)
    const drift = vec3(time.mul(0.03), time.mul(-0.02), time.mul(0.015))
    const steps = 8
    let glow: Node<'vec3'> = vec3(0)
    let veil: Node<'float'> = float(1)
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps
      const q = p.add(dir.mul(chord.mul(t)))
      const coarse = mx_noise_float(q.mul(7).add(drift))
      const fine = mx_noise_float(q.mul(19).sub(drift.mul(2)).add(coarse.mul(1.2)))
      const field = coarse.add(fine.mul(0.45))
      const filaments = field.abs().mul(2.2).oneMinus().clamp().pow(5)
      const clouds = field.smoothstep(0.12, 0.55).mul(0.5)
      const density = filaments.add(clouds)
      const hue = field.mul(0.6).add(view.x.mul(0.3)).add(time.mul(0.01)).add(t * 0.8)
      const tint = cosinePalette(hue, [0.5, 0.38, 0.62], [0.45, 0.4, 0.4], [1, 1, 1], [0.05, 0.3, 0.6])
      const core = 1 - (t - 0.5) ** 2 * 4
      glow = glow.add(tint.mul(density).mul(veil).mul(0.55 + core * 0.9))
      veil = veil.mul(density.mul(0.4).oneMinus().clamp())
    }
    // Compact inclusions at the original parallax depth, not luminous spatial cells.
    const embers = cellularPoints(p.sub(view.mul(0.12)).mul(60), 0.025, 0.16, 0.7).mul(intimate)
    this.colorNode = color(hsl.integer(310, 41, 3.4))
    this.metalness = 0
    this.roughness = 0.02
    this.clearcoat = 1
    this.clearcoatRoughness = 0.01
    this.iridescence = 0.3
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = facing.mul(200).add(300)
    this.emissiveNode = glow.div(steps).mul(3.5).mul(near.mul(0.5).add(0.7)).add(color(hsl.integer(91, 100, 95.2)).mul(embers).mul(1.5)).add(color(hsl.integer(298, 79, 32.5)).mul(rim).mul(0.12))
  }
}
