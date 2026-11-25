import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {hairline as opticalLine} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Aurora curtains in silk; like the true night sky, they burn brightest seen edge-on. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const fold = vec3(0.94, 0, 0.34)
    const edgeOn = view.dot(fold).abs().oneMinus().clamp().pow(1.5)
    const density = edgeOn.mul(1.5).add(0.3)
    const sway = p.y.mul(3.4).add(time.mul(0.55)).sin().mul(1.1).add(mx_noise_float(vec3(p.x.mul(0.7), time.mul(0.12), p.z.mul(0.7))).mul(2.6))
    const phase = p.dot(fold).mul(13).add(sway)
    const primary = opticalLine(phase.sin(), 0.5)
    const secondary = opticalLine(phase.add(2.2).sin(), 0.2)
    const rayPhase = p.dot(vec3(-0.34, 0, 0.94)).mul(46).add(time.mul(1.4))
    const rays = opticalLine(rayPhase.sin(), 0.34).mul(time.mul(2.6).add(p.y.mul(9)).sin().mul(0.35).add(0.65))
    const alt = p.y.mul(1.3).add(0.5).clamp()
    const curtain = mix(color(hsl.integer(153.2, 100, 86)), color(hsl.integer(289, 99, 51)), alt)
    const fringe = mix(curtain, color(hsl.integer(357, 100, 64.4)), alt.pow(5).mul(0.7))
    const breathe = time.mul(0.2).sin().mul(0.25).add(0.75)
    this.colorNode = mix(color(hsl.integer(262, 45, 5)), color(hsl.integer(252, 58, 12)), alt.mul(0.5))
    this.metalness = 0.45
    this.roughnessNode = primary.mul(0.1).add(0.32)
    this.anisotropy = 0.85
    this.iridescence = 0.35
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = alt.mul(340).add(260)
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.2
    this.emissiveNode = fringe.mul(primary.mul(1.5).add(secondary.mul(0.6)).mul(density)).mul(rays.add(0.35)).mul(breathe).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(216, 100, 83.5)).mul(grazing.pow(2)).mul(0.3)).add(fringe.mul(intimate).mul(0.15))
  }
}
