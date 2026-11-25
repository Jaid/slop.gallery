import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, time, vec3} from 'three/tsl'

import {ridge} from '../../candidates/claude_fable/lib/ridge.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Glacier ice with an aurora trapped inside. Frost ferns cover it from afar; your approach melts them back to a glistening water line, revealing clear ice, frozen bubbles, and four depth layers of curtains that drift as you walk around. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    const frostField = mx_fractal_noise_float(p.mul(4.5), 3, 2.1, 0.55).mul(0.5).add(0.5)
    const fern = mx_noise_float(p.mul(21).add(frostField.mul(2)))
    const dendrite = ridge(fern, 0.05)
    const melt = intimate.mul(0.7).add(near.mul(0.2))
    const frostLevel = frostField.sub(melt.mul(0.55)).add(dendrite.mul(0.12))
    const frost = frostLevel.smoothstep(0.32, 0.6)
    const meltLine = frostLevel.sub(0.34).abs().div(0.05).pow(2).negate().exp()
    let aurora: Node<'vec3'> = vec3(0)
    const depths = [0.05, 0.11, 0.18, 0.26]
    for (const [i, depth] of depths.entries()) {
      const q = p.sub(view.mul(depth))
      const curtainNoise = mx_noise_float(vec3(q.x.mul(2.6).add(time.mul(0.06)), q.z.mul(2.6).sub(i * 0.7), time.mul(0.03)))
      const curtain = curtainNoise.abs().smoothstep(0.02, 0.35).oneMinus()
      const rays = q.x.mul(28).add(q.z.mul(17)).add(mx_noise_float(q.mul(3).add(i)).mul(6)).add(time.mul(0.4)).sin().mul(0.5).add(0.5).pow(3)
      const altitude = q.y.mul(2.2).add(0.5).add(mx_noise_float(q.mul(1.5)).mul(0.3))
      const tint = mix(color(hsl.integer(155.3, 100, 86.3)), color(hsl.integer(310, 99, 61)), altitude.clamp())
      aurora = aurora.add(tint.mul(curtain).mul(rays.mul(0.6).add(0.4)).mul(1 - i * 0.18))
    }
    const bq = p.sub(view.mul(0.045)).mul(64)
    const brnd = cellNoiseVec3(bq)
    const bdist = bq.fract().sub(brnd.mul(0.6).add(0.2)).length()
    const bfoot = bq.fwidth().length().max(0.001)
    const bubbles = bdist.smoothstep(0.05, bfoot.mul(0.8).add(0.09)).oneMinus().mul(brnd.z.smoothstep(0.82, 0.86)).mul(bfoot.smoothstep(0.3, 1.1).oneMinus())
    this.colorNode = mix(color(hsl.integer(232, 54, 16)), color(hsl.integer(238, 100, 96)), frost)
    this.transmissionNode = frost.mul(-0.85).add(0.9).clamp()
    this.thickness = 0.5
    this.ior = 1.31
    this.dispersion = 0.1
    this.attenuationColor.set(hsl.integer(221, 62, 74))
    this.attenuationDistance = 0.8
    this.roughnessNode = float(0.03).mix(0.6, frost).sub(meltLine.mul(0.03)).clamp()
    this.metalness = 0
    this.clearcoatNode = frost.oneMinus().mul(0.9).add(meltLine.mul(0.6)).clamp()
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(frost.mul(0.5).add(dendrite.mul(frost).mul(0.5)).add(mx_noise_float(p.mul(9)).mul(0.1)), 0.0014)
    const frostGlint = glints(normalViewGeometry.add(mx_noise_vec3(p.mul(80)).mul(0.25)).normalize(), 80).mul(frost).mul(dendrite.mul(0.5).add(0.5))
    const auroraVisible = aurora.mul(frost.mul(0.75).oneMinus()).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = auroraVisible.mul(0.9)
      .add(color(hsl.integer(213, 100, 97)).mul(frostGlint).mul(0.35))
      .add(color(hsl.integer(217, 99, 86)).mul(bubbles).mul(near).mul(0.5))
      .add(color(hsl.integer(228, 99, 75)).mul(rim).mul(0.1))
      .add(color(hsl.integer(0, 0, 100)).mul(meltLine).mul(intimate).mul(0.08))
  }
}
