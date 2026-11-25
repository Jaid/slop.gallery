import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, time, uv, vec2, vec3} from 'three/tsl'

import {fill, ruled, stroke, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function feathers(tube: Node<'vec2'>) {
  const grid = tube.mul(vec2(32, 6))
  const staggered = vec2(grid.x.add(grid.y.floor().mod(2).mul(0.5)), grid.y)
  const q = staggered.fract().sub(0.5)
  const id = wrapCell(staggered.floor(), vec2(32, 6))
  const random = cellNoiseVec3(vec3(id, 7))
  const r = vec2(q.x.mul(1.12), q.y.add(0.48)).length()
  const theta = atan(q.x, q.y.add(0.51))
  const eye = q.sub(vec2(0, 0.12)).mul(vec2(1.55, 1.05)).length()
  return {
    grid,
    q,
    random,
    r,
    theta,
    eye,
    aa: grid.fwidth().length(),
  }
}
/** Cloisonné fans, with the enamel eye moving beneath its fixed metal ribs. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    const {near, intimate, grazing, facing, tangent, V} = exhibitionFrame()
    const front = feathers(uv())
    const inner = feathers(uv().sub(tubeRay().mul(0.013)))
    const {q, r, theta, aa, random} = front
    const scallop = stroke(r.sub(0.82), 0.016, aa)
    const spine = stroke(q.x, 0.009, aa).mul(q.y.smoothstep(0.1, 0.3).oneMinus())
    const barbs = ruled(theta.mul(12).add(r.mul(2.2)), 0.07)
      .mul(fill(r.sub(0.79), aa)).mul(inner.eye.smoothstep(0.16, 0.28))
    const eyeRim = stroke(front.eye.sub(0.26), 0.016, aa).add(stroke(front.eye.sub(0.29), 0.006, aa))
    const metal = scallop.add(spine).add(eyeRim).add(barbs.mul(0.26)).clamp()
    const eyeFill = fill(inner.eye.sub(0.237), inner.aa)
    const iris = stroke(inner.eye.sub(0.15), 0.037, inner.aa)
    const pupil = fill(inner.eye.sub(0.085), inner.aa)
    const nap = V.dot(tangent).mul(0.5).add(0.5)
    const enamel = mix(color(hsl.integer(198, 93, 29)), color(hsl.integer(236, 82, 39.5)), nap.mul(0.65).add(random.x.mul(0.3)))
    const featherTint = mix(enamel, color(hsl.integer(129, 72, 53)), wave(theta.mul(24).add(r.mul(14))).mul(0.3))
    const jewel = mix(mix(color(hsl.integer(263, 81, 18)), color(hsl.integer(312, 65, 32)), grazing.mul(0.8)), color(hsl.integer(191, 93, 55)), iris)
    const deepEye = mix(jewel, color(hsl.integer(270, 65, 8)), pupil)
    const gold = mix(color(hsl.integer(76, 58, 45)), color(hsl.integer(87, 65, 80.5)), facing.mul(0.4).add(0.35))
    this.colorNode = mix(mix(featherTint, deepEye, eyeFill), gold, metal)
    this.metalnessNode = metal.mul(0.32).add(0.46)
    this.roughnessNode = float(0.28).sub(eyeFill.mul(0.11)).sub(metal.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.085
    this.anisotropyNode = vec2(0.5, 0.1)
    this.iridescenceNode = metal.oneMinus().mul(0.78)
    this.iridescenceIOR = 1.36
    this.iridescenceThicknessNode = inner.eye.mul(440).add(random.y.mul(65)).add(235)
    const ribs = barbs.mul(intimate.mul(0.6).add(0.4)).mul(0.00024)
    this.normalNode = proceduralNormal(r.pow2().mul(-0.0008).add(metal.mul(0.0006)).add(ribs), 1)
    const procession = uv().x.mul(TAU * 2).add(uv().y.mul(TAU)).sub(time.mul(0.36)).sin().mul(0.5).add(0.5).pow(3)
    this.emissiveNode = color(hsl.integer(183, 70, 67)).mul(iris).mul(eyeFill).mul(procession).mul(near).mul(0.1)
  }
}
