import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {inkFill} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Oriented, buried platelets diffract independently; the milk-white host remains softly lit and tangible. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.68)
    this.name = data.id
    const {p, view, grazing, intimate, near} = viewerFrame()
    let fire: Node<'vec3'> = vec3(0)
    let chips: Node<'float'> = float(0)
    for (let i = 3;i >= 0;i--) {
      const q = p.sub(view.mul(0.018 + i * 0.025)).mul(14 + i * 2).add(i * 17.13).toVar()
      const seed = cellNoiseVec3(q.floor()).toVar()
      const center = seed.mul(0.3).add(0.35)
      const local = q.fract().sub(center).toVar()
      const axis = cellNoiseVec3(q.floor().add(139)).sub(0.5).normalize().toVar()
      const planar = local.dot(axis)
      const radius = local.sub(axis.mul(planar)).length()
      const aa = q.fwidth().length().max(0.0001)
      const flake = inkFill(radius.sub(seed.z.mul(0.04).add(0.285)), aa)
        .mul(inkFill(planar.abs().sub(0.085), aa)).mul(seed.y.smoothstep(0.18, 0.42))
        .mul(aa.smoothstep(0.4, 1.4).oneMinus()).toVar()
      const opticalAngle = view.dot(axis).abs().clamp()
      const phase = opticalAngle.mul(11).add(seed.x.mul(9)).add(time.mul(0.07))
      const spectrum = spectralColor(phase).pow(2.1)
      const flash = opticalAngle.smoothstep(0.15, 0.7).mul(seed.z.mul(0.4).add(0.6))
      fire = mix(fire, spectrum.mul(flash).mul(1.25), flake.mul(0.85)).toVar()
      chips = chips.add(flake.mul(0.28)).clamp().toVar()
    }
    const stone = mx_noise_float(p.mul(9)).mul(0.5).add(0.5).toVar()
    const milk = mix(color(hsl.integer(229, 9, 87)), color(hsl.integer(62, 54, 92.4)), stone)
    const veins = mx_noise_float(p.mul(22).add(stone.mul(2))).toVar()
    const intimateFire = near.mul(0.16).add(0.84)
    this.colorNode = mix(milk, milk.mul(0.14).add(fire.mul(0.72)), chips.mul(3.5).clamp())
    this.emissiveNode = fire.mul(0.82).mul(intimateFire).add(color(hsl.integer(243, 33, 81)).mul(grazing.pow(4)).mul(0.045))
    this.metalness = 0.13
    this.roughnessNode = float(0.245).add(veins.abs().mul(0.05)).sub(chips.mul(0.09))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.065
    this.ior = 1.46
    this.iridescenceNode = grazing.pow(2).mul(0.32).add(chips.mul(0.22))
    this.iridescenceIOR = 1.36
    this.iridescenceThicknessNode = stone.mul(240).add(180)
    this.normalNode = proceduralNormal(stone.mul(0.0007).add(veins.mul(0.00028).mul(intimate)), 0.7)
  }
}
