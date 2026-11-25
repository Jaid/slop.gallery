import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_hsvtorgb, mx_noise_float, mx_noise_vec3, normalViewGeometry, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Noble opal: a milky silica stone whose ordered domains diffract white light into pure spectral color. Each domain has its own lattice axis, and a domain only lights up when the line of sight grazes that axis, so the fire ignites and dies in discrete flashes instead of washing the whole stone in a rainbow. The domains are sampled below the surface, which puts the color genuinely inside the stone. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const depth = 0.09
    const q = p.sub(view.mul(depth))
    const axis = mx_noise_vec3(q.mul(10)).normalize()
    const alignment = view.dot(axis).abs()
    const domainHue = mx_noise_float(q.mul(10).add(vec3(31.7, 11.3, 7.9))).mul(0.5).add(0.5)
    const hue = alignment.mul(1.7).add(domainHue).fract()
    const spectral = mx_hsvtorgb(vec3(hue, 0.95, 1))
    const window = alignment.smoothstep(0.8, 0.97)
    const order = mx_noise_float(q.mul(14).add(vec3(5.5, 2.2, 8.8))).mul(0.5).add(0.5).smoothstep(0.28, 0.68)
    const flash = window.mul(order)
    const potch = mix(color(hsl.integer(88, 24, 71)), color(hsl.integer(87, 24, 48)), mx_noise_float(p.mul(6.2)).mul(0.5).add(0.5).mul(0.8).add(mx_noise_float(p.mul(23)).mul(0.5).add(0.5).mul(0.2)))
    this.colorNode = mix(potch, spectral, flash)
    this.metalness = 0
    this.roughnessNode = float(0.08).sub(flash.mul(0.03))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.iridescence = 0.25
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = hue.mul(400).add(220)
    const flame = order.mul(0.0006).add(mx_noise_float(p.mul(11)).mul(0.0002)).add(mx_noise_float(p.mul(37)).mul(0.00008))
    this.normalNode = proceduralNormal(flame, 1)
    this.clearcoatNormalNode = this.normalNode
// Pinfire: the smallest domains resolve into single glittering points only when you lean in.
    const pinfire = cellularPoints(q.mul(64), 0.02, 0.13, 0.84).mul(window).mul(intimate)
    const fire = glints(normalViewGeometry, 200).mul(order).mul(near)
    this.emissiveNode = spectral.mul(flash).mul(0.4)
      .add(color(hsl.integer(87, 100, 97.7)).mul(pinfire).mul(1.4))
      .add(color(hsl.integer(87, 100, 97)).mul(fire).mul(0.5))
      .add(color(hsl.integer(81, 100, 93.3)).mul(grazing.pow(3)).mul(0.05))
  }
}
