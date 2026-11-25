import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, near} = viewerFrame()
    const drift = vec3(time.mul(0.05), time.mul(-0.03), time.mul(0.02))
    const field = mx_noise_float(p.mul(1.2).add(drift))
    const curtainPhase = p.y.mul(3.5).add(field.mul(6)).add(time.mul(0.4))
    const rays = opticalLine(curtainPhase.sin(), 0.035)
    const veil = curtainPhase.cos().mul(0.5).add(0.5).pow(4)
    const aurora = mix(color(hsl.integer(156.7, 100, 86)), color(hsl.integer(311, 100, 64.6)), curtainPhase.sin().mul(0.5).add(0.5))
    const aurora2 = mix(aurora, color(hsl.integer(226, 100, 77.3)), field.mul(0.5).add(0.5))
    this.colorNode = color(hsl.integer(251, 50, 4))
    this.transmission = 0.92
    this.thickness = 0.9
    this.ior = 1.08
    this.attenuationColor.set(hsl.integer(176, 100, 28))
    this.attenuationDistance = 0.6
    this.roughness = 0.04
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.iridescence = 1
    this.iridescenceIOR = 1.15
    this.iridescenceThicknessNode = curtainPhase.mul(120).add(180)
    this.normalNode = liquidNormal(near, 0.14)
    this.emissiveNode = aurora2.mul(rays.mul(1.8).add(veil.mul(0.7))).mul(near.mul(0.8).add(0.35)).add(color(hsl.integer(211, 100, 89.3)).mul(grazing.pow(3)).mul(0.35))
  }
}
