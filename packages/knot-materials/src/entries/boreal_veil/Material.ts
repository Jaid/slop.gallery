import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** One aurora curtain: noise combed into vertical filaments, folded by slow drift, with a soft lower hem. */
function curtain(point: Node<'vec3'>, seed: Node<'float'> | number) {
  const s = typeof seed === 'number' ? float(seed) : seed
  const s3 = vec3(s, s.mul(1.7), s.mul(0.4))
  const drift = mx_fractal_noise_float(vec3(point.x.mul(2.5), point.z.mul(2.5), point.y.mul(0.4)).add(s3), 3, 2, 0.5).mul(0.22)
  const combed = mx_fractal_noise_float(vec3(point.x.add(drift).mul(48), point.y.mul(1.1), point.z.add(drift).mul(48)).add(s3), 4, 2, 0.55)
  const ray = combed.mul(0.5).add(0.5).pow(3)
  const hem = point.y.smoothstep(-0.62, -0.05).mul(point.y.smoothstep(0.2, 0.62).oneMinus())
  const shimmer = mx_noise_float(vec3(point.x.mul(8), point.z.mul(8), point.y.mul(0.5)).add(s3)).mul(0.3).add(0.7)
  return {
    fade: hem.mul(shimmer),
    ray,
  }
}

/** Sheets of aurora hang along the knot like combed light. Three veils drift at different depths, so walking slides them against one another exactly as the real sky does; the rays answer your distance — far away they are broad silk, close up they comb into individual filaments that breathe emerald into violet. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.1)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const t = time.mul(0.05)
    const wander = p.add(vec3(t.mul(0.4), t.mul(0.2), float(0)))
    const veils = [0, 1, 2].map(index => curtain(wander, float(index).mul(31).add(3)))
    const veil = veils[0].fade.mul(veils[0].ray).mul(0.4).add(veils[1].fade.mul(veils[1].ray).mul(0.7)).add(veils[2].fade.mul(veils[2].ray))
    const height = p.y.add(0.5).clamp(0, 1)
    const emerald = color(hsl.integer(152, 99.9, 85.9))
    const teal = color(hsl.integer(190, 94, 71))
    const violet = color(hsl.integer(304, 88, 45.4))
    const hue = mix(mix(emerald, teal, height.mul(1.4).clamp()), violet, height.smoothstep(0.62, 0.98))
    const density = veil.mul(near.mul(0.45).add(0.55)).mul(grazing.mul(0.5).add(0.55))
    this.colorNode = color(hsl.integer(270, 42, 3))
    this.metalness = 0
    this.roughnessNode = float(0.95).sub(density.mul(0.1))
    this.clearcoat = 0.05
    this.clearcoatRoughness = 0.3
    this.envMapIntensity = 0.1
    this.normalNode = proceduralNormal(veil.mul(0.04), 0.08).normalize()
    const jitter = vec3(mx_noise_float(p.mul(55)), mx_noise_float(p.mul(55).add(9)), mx_noise_float(p.mul(55).add(17))).sub(0.5)
    const dust = glints(normalLocal.add(jitter.mul(0.15)), 110).mul(intimate).mul(0.1)
    this.emissiveNode = hue.mul(density.mul(2.1)).add(hue.mul(grazing.pow(2).mul(veil).mul(0.6))).add(color(hsl.integer(160, 99, 94.6)).mul(dust))
  }
}
