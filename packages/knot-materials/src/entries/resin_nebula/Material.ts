import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A nebula sealed inside clear resin. The polished skin only reflects the room; everything luminous lives at three depths beneath it, sampled along the refracted line of sight. Circle the piece and the clouds shear past each other in true parallax; lean in and near star shells resolve into individual suns while the far side still burns as one galaxy. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// Loop-closed drift: one full circuit per two-second exhibition loop.
    const drift = vec3(time.mul(Math.PI).cos(), time.mul(Math.PI).sin(), time.mul(Math.PI).mul(0.7).cos()).mul(0.14)
    const layer = (depth: number, scale: number, seed: number, low: number, high: number) => {
      const q = p.sub(view.mul(depth)).add(drift.mul(depth * 4 + 0.4))
      const density = mx_fractal_noise_float(q.mul(scale).add(seed), 4, 2.1, 0.5).mul(0.5).add(0.5)
      const cloud = density.smoothstep(low, high).pow(1.6)
      const core = density.smoothstep(0.8, 0.97).pow(3)
      const stars = starfield(q.normalize(), 44, 0.962)
      return {
        cloud,
        core,
        stars,
      }
    }
    const deep = layer(0.3, 3.1, 4.7, 0.5, 0.88)
    const middle = layer(0.17, 4.6, 17.9, 0.53, 0.9)
    const shallow = layer(0.07, 7.2, 31.3, 0.56, 0.92)
    const farGlow = near.oneMinus().mul(0.45).add(0.9)
    let emissive: Node<'vec3'> = color(hsl.integer(265, 44, 5)).mul(grazing.pow(2).mul(0.6).add(0.25))
// Deep violet body, teal mid-clouds, magenta veils near the skin – additive depth, oldest first.
    emissive = emissive.add(color(hsl.integer(292, 91, 34.3)).mul(deep.cloud).mul(1.45))
      .add(color(hsl.integer(212, 98, 62)).mul(middle.cloud).mul(1.6))
      .add(color(hsl.integer(351, 86, 58.4)).mul(shallow.cloud).mul(1.25))
      .add(color(hsl.integer(83, 100, 96.6)).mul(deep.core.add(middle.core).add(shallow.core)).mul(2.2))
      .add(deep.stars.mul(0.55).mul(farGlow))
      .add(middle.stars.mul(0.85).mul(near.mul(0.6).add(0.55)))
      .add(shallow.stars.mul(1.5).mul(intimate.mul(1.3).add(0.3)))
// A breath of gas clings to the resin itself so the surface never reads as empty glass.
    const skinDust = mx_fractal_noise_float(p.mul(9).add(drift), 3, 2, 0.5).mul(0.5).add(0.5)
    emissive = emissive.add(mix(color(hsl.integer(262, 94, 38)), color(hsl.integer(345, 88, 41.3)), skinDust).mul(skinDust.smoothstep(0.55, 0.9)).mul(0.4))
      .add(color(hsl.integer(214, 100, 85.5)).mul(grazing.pow(3)).mul(0.38))
    this.colorNode = color(hsl.integer(271, 47, 3))
    this.metalness = 0
    this.roughness = 0.09
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    this.emissiveNode = emissive.mul(farGlow)
  }
}
