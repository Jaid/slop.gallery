import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {angle, coverage, rotatePoint, segment} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Sixfold hoarfrost crystals suspended beneath blue ice, with slow deposition at their tips. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    let frost: Node<'float'> = float(0)
    let needles: Node<'float'> = float(0)
    for (let layer = 0; layer < 3; layer++) {
      const modules = vec2(19, 4)
      const q = tube.sub(ray.mul(0.004 + layer * 0.02)).mul(modules).add(vec2(layer * 0.31, layer * 0.41))
      const aa = q.fwidth().length().max(0.0001)
      const cell = q.floor().mod(modules).add(modules).mod(modules)
      const seed = mx_cell_noise_vec3(vec3(cell, 32 + layer))
      const c = rotatePoint(q.fract().sub(0.5).mul(seed.y.mul(0.6).add(0.8)), seed.x.mul(2.4))
      const radius = c.length()
      const theta = angle(c)
      const wedge = theta.add(Math.PI / 6).mod(Math.PI / 3).add(Math.PI / 3).mod(Math.PI / 3).sub(Math.PI / 6)
      const arm = vec2(radius.mul(wedge.cos()), radius.mul(wedge.sin()).abs())
      const growth = seed.y.mul(6.28).add(time.mul(0.22)).sin().mul(0.025).add(0.305)
      let d = segment(arm, vec2(0, 0), vec2(growth, 0)).sub(0.0065)
      for (let branch = 0; branch < 4; branch++) {
        const x = 0.075 + branch * 0.05
        const b = segment(arm, vec2(x, 0), vec2(x + 0.052, 0.052 + (3 - branch) * 0.009)).sub(0.0045)
        const secondary = segment(arm, vec2(x + 0.035, 0.04), vec2(x + 0.026, 0.071)).sub(0.0024)
        d = d.min(b).min(secondary)
      }
      const crystal = coverage(d, aa).mul(seed.z.mul(0.4).add(0.6))
      frost = frost.max(crystal.mul(1 - layer * 0.26))
      needles = needles.max(coverage(d.sub(0.017), aa).mul(0.5 - layer * 0.12))
    }
    const trapped = mx_noise_float(p.mul(26)).mul(0.5).add(0.5)
    const weather = mx_noise_float(p.mul(7)).add(mx_noise_float(p.mul(21)).mul(0.3))
    const rime = weather.smoothstep(0.01, 0.29)
    frost = frost.mul(weather.smoothstep(-0.22, 0.17))
    const frozen = rime.mul(0.83).max(frost)
    const facets = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
    const core = mix(color(hsl.integer(231, 79, 13)), color(hsl.integer(217, 81, 38)), facing.mul(0.7).add(trapped.mul(0.18)))
    const crystalColor = mix(color(hsl.integer(210, 43, 70)), color(hsl.integer(157, 65, 96.7)), frost)
    this.colorNode = mix(core, crystalColor, frozen.mul(0.87).add(needles.mul(0.1)).clamp())
    this.metalness = 0.12
    this.roughnessNode = float(0.12).add(frozen.mul(0.67))
    this.clearcoat = 1
    this.clearcoatNode = frozen.mul(-0.9).add(1)
    this.clearcoatRoughness = 0.065
    this.ior = 1.31
    this.normalNode = proceduralNormal(trapped.mul(0.001).add(frost.mul(0.0014)).add(facets.mul(frozen).mul(0.0006)), 0.7)
    const scintillation = time.mul(0.35).add(p.y.mul(15)).sin().mul(0.08).add(0.92)
    this.emissiveNode = color(hsl.integer(201, 67, 81)).mul(needles).mul(0.2).mul(scintillation)
      .add(color(hsl.integer(171, 100, 96.7)).mul(frost).mul(grazing.pow(2)).mul(intimate.mul(0.2).add(0.12)))
      .add(color(hsl.integer(207, 86, 55)).mul(facing).mul(0.09))
  }
}
