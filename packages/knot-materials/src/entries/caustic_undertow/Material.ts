import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Light focused by a moving surface onto a drowned knot. Two Voronoi nets drift at different speeds; the nets sharpen as the viewer approaches. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, near} = viewerFrame()
    const t = time
    const ripple = mx_noise_vec3(p.mul(1.1).add(vec3(0, t.mul(0.02), 0))).mul(0.2)
    const warped = p.add(ripple)
    const netA = mx_worley_noise_vec3(warped.mul(8.5).add(vec3(0, t.mul(0.26), 0)), 1, 0)
    const netB = mx_worley_noise_vec3(warped.mul(6.2).add(vec3(t.mul(-0.19), 0, 2.4)), 1, 0)
// Up close the nets narrow into hard, bright filaments; from afar they blur into soft, dim sheets.
    const width = near.mul(-0.1).add(0.16)
    const ridgeA = netA.y.sub(netA.x).smoothstep(0, width).oneMinus()
    const ridgeB = netB.y.sub(netB.x).smoothstep(0, width.mul(1.2)).oneMinus()
    const light = ridgeA.mul(ridgeB).mul(1.5).add(ridgeA.max(ridgeB).pow(3).mul(0.5))
    const water = mx_noise_float(p.mul(2.3).add(vec3(0, t.mul(0.05), 0))).mul(0.5).add(0.5)
    const sunlight = mix(color(hsl.integer(85, 100, 90.4)), color(hsl.integer(204, 99, 88)), water)
    this.colorNode = mix(color(hsl.integer(205, 68, 8)), color(hsl.integer(203, 82, 23)), water)
    this.metalness = 0
    this.roughness = 0.28
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.1
    this.emissiveNode = sunlight.mul(light).mul(near.mul(0.9).add(0.7))
  }
}
