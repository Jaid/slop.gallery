import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** A parallax star volume and a coherent logarithmic spiral behind a very dark glass shell. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = data.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    let stars: Node<'vec3'> = vec3(0)
    for (let i = 0;i < 7;i++) {
      const sample = p.sub(view.mul(0.015 + i * 0.022)).add(vec3(i * 0.41, 0, time.mul(0.0015)))
      stars = stars.add(starfield(sample, 45, 0.82).mul(0.7 - i * 0.062)).toVar()
    }
    const deep = p.sub(view.mul(0.15)).toVar()
    const q = deep.xy.sub(vec3(0.19, -0.13, 0).xy).mul(3.6).toVar()
    const radius = q.length().max(0.0001).toVar()
    const theta = atan(q.y, q.x)
    const spiral = theta.mul(3).sub(radius.add(0.12).log().mul(7)).sub(time.mul(0.085))
    const arms = spiral.cos().mul(0.5).add(0.5).pow(9).toVar()
    const dust = mx_fractal_noise_float(deep.mul(16).add(vec3(0, time.mul(0.014), 0)), 3, 2, 0.48).mul(0.5).add(0.5).clamp().toVar()
    const halo = radius.pow2().mul(-1.3).exp()
    const galaxy = arms.mul(halo).mul(dust.smoothstep(0.22, 0.8)).toVar()
    const core = radius.pow2().mul(-30).exp()
    const galaxyTint = mix(color(hsl.integer(271, 60, 44)), color(hsl.integer(79, 100, 89.5)), radius.smoothstep(0.2, 1.4).oneMinus())
    const cloud = mx_noise_float(deep.mul(6).add(vec3(time.mul(0.02), 0, 0))).mul(0.5).add(0.5)
    const night = mix(color(hsl.integer(266, 55, 3.4)), color(hsl.integer(273, 42, 10)), cloud.mul(0.6))
    this.colorNode = night
    this.metalness = 0.18
    this.roughnessNode = float(0.14).add(cloud.mul(0.035))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.ior = 1.52
    this.specularIntensity = 0.55
    this.emissiveNode = stars.mul(near.mul(0.25).add(0.85))
      .add(galaxyTint.mul(galaxy).mul(0.56))
      .add(color(hsl.integer(90, 100, 95.6)).mul(core).mul(0.8))
      .add(color(hsl.integer(268, 48, 30)).mul(halo).mul(dust).mul(0.065))
      .add(color(hsl.integer(260, 51, 55)).mul(grazing.pow(5)).mul(0.075))
    this.iridescenceNode = grazing.pow(3).mul(0.4)
    this.iridescenceIOR = 1.28
    this.iridescenceThicknessNode = dust.mul(160).add(190)
    this.normalNode = proceduralNormal(cloud.mul(0.00045).add(dust.mul(0.0001).mul(intimate)), 0.55)
  }
}
