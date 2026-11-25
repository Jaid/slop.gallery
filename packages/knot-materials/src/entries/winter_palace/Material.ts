import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry, uv, vec2} from 'three/tsl'

import {disk, ring, segment} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {near, grazing} = viewerFrame()
    const tile = uv().mul(vec2(10, 2))
    const p = tile.fract().sub(0.5).sub(tubeRay().mul(0.012))
    const aa = tile.fwidth().length().mul(0.65).max(0.0001)
    let crystal: Node<'float'> = float(0)
    for (let k = 0;k < 6;k++) {
      const angle = k * Math.PI / 3
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const q = vec2(p.x.mul(c).add(p.y.mul(s)), p.y.mul(c).sub(p.x.mul(s)))
      crystal = crystal.max(segment(q, [0, 0.02], [0.37, 0.02], 0.006, aa))
      for (const t of [0.16, 0.27]) {
        crystal = crystal.max(segment(q, [t, 0.02], [t - 0.062, 0.09], 0.004, aa))
        crystal = crystal.max(segment(q, [t, 0.02], [t - 0.062, -0.05], 0.004, aa))
      }
      crystal = crystal.max(disk(q.sub(vec2(0.37, 0.02)), 0.014, aa))
    }
    const medallion = ring(p, 0.092, 0.004, aa).max(ring(p, 0.42, 0.002, aa).mul(0.5))
    const frost = mx_noise_float(positionGeometry.mul(19)).mul(0.5).add(0.5)
    const fine = mx_noise_float(positionGeometry.mul(78)).mul(0.5).add(0.5)
    const snow = frost.smoothstep(0.55, 0.84)
    this.colorNode = mix(color(hsl.integer(251, 73, 22)), color(hsl.integer(206, 52, 85)), snow.mul(0.72).add(0.12))
    this.colorNode = mix(this.colorNode, color(hsl.integer(176, 69, 97)), crystal.mul(0.66).add(medallion.mul(0.3)).clamp())
    this.metalness = 0.04
    this.roughnessNode = snow.mul(0.32).add(0.075)
    this.transmission = 0.44
    this.thickness = 0.28
    this.ior = 1.31
    this.attenuationColor.set(hsl.integer(231, 67, 71))
    this.attenuationDistance = 0.62
    this.clearcoat = 0.74
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(snow.mul(0.004).add(fine.mul(0.0006)).add(crystal.mul(0.002)), 0.8)
    this.emissiveNode = color(hsl.integer(233, 69, 76)).mul(crystal).mul(near.mul(0.19).add(0.075))
      .add(color(hsl.integer(214, 100, 96)).mul(grazing.pow(3)).mul(0.21))
  }
}
