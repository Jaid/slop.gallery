import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_noise_float, normalLocal, refract, time, vec3} from 'three/tsl'

import {proceduralNormal, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = data.id
    const {p, view, facing, near, grazing} = viewerFrame()
    const ray = refract(view.negate(), normalLocal.normalize(), 1 / 1.54)
    const chord = facing.mul(0.17).add(0.08)
    let visibility: Node<'float'> = float(1)
    let volume: Node<'vec3'> = vec3(0)
    // A solid botanical volume in object space. Refracted rays cross independently oriented
    // fern sheets; their support has finite thickness, not a decal attached to the tube UVs.
    const steps = 16
    for (let i = 0;i < steps;i++) {
      const depth = (i + 0.5) / steps
      const sample = p.add(ray.mul(chord).mul(depth))
      const q = sample.mul(6.5).add(vec3(0.1, 0.3, 0.2))
      const seed = mx_cell_noise_vec3(q.floor())
      const c = q.fract().sub(0.5)
      const angle = seed.x.mul(6.283185)
      const x = c.x.mul(angle.cos()).add(c.z.mul(angle.sin()))
      const z = c.z.mul(angle.cos()).sub(c.x.mul(angle.sin()))
      const bend = c.y.mul(6).sin().mul(0.06)
      const stemX = x.sub(bend)
      const extent = c.y.abs().smoothstep(0.31, 0.4).oneMinus()
      const taper = c.y.add(0.42).div(0.84).clamp().oneMinus().mul(0.21).add(0.025)
      const row = c.y.mul(7).add(stemX.abs().mul(2.5)).fract().sub(0.5)
      const pinna = row.abs().div(0.27).add(stemX.abs().div(taper)).smoothstep(0.65, 1).oneMinus()
      const stem = stemX.abs().smoothstep(0.013, 0.03).oneMinus()
      const plane = z.mul(z).mul(-110).exp()
      const fern = pinna.max(stem).mul(extent).mul(plane).mul(seed.z.smoothstep(0.25, 0.5))
      // Front-to-back compositing supplies real occlusion, not additive overlapping leaves.
      const opacity = fern.mul(0.84)
      const fossil = mix(color(hsl.integer(46, 75, 7)), color(hsl.integer(49, 82, 28)), float(depth)).mul(0.3)
      volume = volume.add(fossil.mul(opacity).mul(visibility))
      visibility = visibility.mul(opacity.oneMinus())
      const bubble = c.sub(seed.sub(0.5).mul(0.4)).length().sub(0.135).abs().smoothstep(0.009, 0.035).oneMinus().mul(seed.y.smoothstep(0.7, 0.9))
      volume = volume.add(color(hsl.integer(79.6, 100, 83)).mul(bubble).mul(visibility).mul(0.035))
    }
    const inner = p.add(ray.mul(chord.mul(0.7)))
    const flow = mx_noise_float(inner.mul(8).add(vec3(0, time.mul(0.035), 0))).mul(0.5).add(0.5)
    const light = mix(color(hsl.integer(36, 99, 34)), color(hsl.integer(76, 100, 79)), flow.mul(0.5).add(facing.mul(0.4)))
    const caustic = inner.y.mul(32).add(inner.x.mul(19)).add(flow.mul(9)).sin().smoothstep(0.8, 1)
    const backlight = light.mul(facing.mul(0.8).add(0.45)).add(color(hsl.integer(87, 100, 91)).mul(caustic).mul(0.2))
    volume = volume.add(backlight.mul(visibility))
    this.colorNode = color(hsl.integer(44, 83, 10))
    this.roughness = 0.14
    this.ior = 1.54
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.09
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(22)).mul(0.0001), 1)
    this.emissiveNode = volume.mul(near.mul(0.2).add(0.8)).add(color(hsl.integer(56, 97, 61.4)).mul(grazing.pow(4)).mul(0.08))
  }
}
