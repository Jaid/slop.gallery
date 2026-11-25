import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, time, vec3} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A soap bubble stretched over the knot: thin-film interference from a drifting thickness field, with drainage toward the base and Plateau borders where films meet. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {p, grazing} = viewerFrame()
    const t = time.mul(0.03)
// Marangoni currents: slow, curling flow that stirs the film.
    const current = vec3(mx_noise_float(p.mul(1.3).add(vec3(t, 0, 0))), mx_noise_float(p.mul(1.3).add(vec3(0, t, 5.2))), mx_noise_float(p.mul(1.3).add(vec3(2.7, t.mul(1.1), 0))))
    const flowed = p.add(current.mul(0.42))
    const swirl = mx_fractal_noise_float(flowed.mul(2.4), 4, 2.05, 0.5).mul(0.9).add(0.5)
// Gravity drains the film: it thins toward the top and gathers near the bottom.
    const drain = p.y.mul(-1.1).add(0.5).clamp(0, 1)
// Plateau borders: the Voronoi edges where three films meet, which are thicker, darker and more opaque.
    const web = mx_worley_noise_vec3(flowed.mul(3.4), 1, 0)
    const border = web.y.sub(web.x).smoothstep(0, 0.09).oneMinus()
    const thickness = swirl.mul(0.65).add(drain.mul(0.45)).add(border.mul(0.25)).clamp(0, 1)
    const nanometers = thickness.pow(1.1).mul(820).add(120)
    const opacity = grazing.mul(0.55).add(0.12).add(border.mul(0.55)).clamp(0, 1)
    this.transparent = true
    this.depthWrite = true
    this.side = DoubleSide
    this.colorNode = color(hsl.integer(263, 100, 96))
    this.metalness = 0
    this.roughness = 0.04
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 1
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = nanometers
    this.opacityNode = opacity
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(border.mul(0.02))
  }
}
