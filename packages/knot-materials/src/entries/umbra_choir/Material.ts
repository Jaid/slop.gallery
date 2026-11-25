import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, positionGeometry, time, uv, vec2} from 'three/tsl'

import {band, disk, ring} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.78)
    this.name = knotData.id
    const tile = uv().mul(vec2(13, 2))
    const p = tile.fract().sub(0.5)
    const aa = tile.fwidth().length().mul(0.6).max(0.0001)
    const {grazing, near} = viewerFrame()
    const hidden = p.sub(tubeRay().mul(0.026))
    const corona = ring(hidden, 0.255, 0.018, aa).mul(1.1).add(ring(hidden, 0.33, 0.0025, aa).mul(0.5))
    const rays = band(hidden.x.mul(63).add(hidden.y.mul(71)).add(time.mul(0.13)))
    const burst = corona.mul(rays.mul(0.45).add(0.6))
    const darkMoon = disk(p, 0.206, aa)
    const coldRim = ring(p, 0.208, 0.007, aa)
    const bezel = ring(p, 0.375, 0.003, aa)
    const pit = mx_noise_float(positionGeometry.mul(37)).mul(0.5).add(0.5)
    const surface = mix(color(hsl.integer(240, 12, 9)), color(hsl.integer(135, 5, 22)), pit.mul(0.5))
    this.colorNode = mix(surface, color(hsl.integer(240, 35, 4)), darkMoon.mul(0.92))
    this.colorNode = mix(this.colorNode, color(hsl.integer(81, 45, 64)), bezel.mul(0.54).add(coldRim.mul(0.23)))
    this.metalnessNode = darkMoon.mul(0.36).add(bezel.mul(0.55)).add(0.38)
    this.roughnessNode = darkMoon.mul(-0.36).add(0.64).sub(bezel.mul(0.2))
    this.clearcoatNode = darkMoon.mul(0.9)
    this.clearcoatRoughness = 0.07
    this.normalNode = proceduralNormal(pit.mul(0.0015).add(bezel.mul(0.003)).sub(darkMoon.mul(0.004)), 1)
    this.emissiveNode = color(hsl.integer(59, 100, 73)).mul(burst).mul(darkMoon.oneMinus()).mul(grazing.mul(0.9).add(0.24))
      .add(color(hsl.integer(95, 100, 95)).mul(coldRim).mul(grazing.pow(2)).mul(0.9))
      .add(color(hsl.integer(53, 77, 48)).mul(bezel).mul(near).mul(0.055))
  }
}
