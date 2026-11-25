import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.3
    // Alpha hashing currently produces an invalid Tint pipeline for these procedural opacity graphs.
    // TODO: Migrate to alphaHash again when Chromium WebGPU Tint compiler is less buggy.
    // Depth-writing alpha blending keeps the fade smooth while avoiding the old self-sorting flicker.
    this.transparent = true
    this.depthWrite = true
    this.side = DoubleSide
    const {p, view, rim, near, intimate} = viewerFrame()
    const phase = p.dot(view).mul(18).add(time.mul(1.7))
    const interference = phase.sin().mul(phase.mul(0.7).add(view.x.mul(4)).cos()).abs()
    // Localize collapse events so emission and opacity never expose whole cubic noise cells.
    const collapse = cellularPoints(p.mul(26).add(view.mul(3)).add(time.mul(0.5)), 0.06, 0.24, 0.75)
    const voidNoise = mx_noise_float(p.mul(9).sub(time.mul(0.2)))
    const probability = interference.mul(0.6).add(collapse.mul(0.8)).add(voidNoise.mul(0.2)).clamp()
    const quantum = mix(color(hsl.integer(301, 100, 8)), color(hsl.integer(297, 100, 68)), probability).add(color(hsl.integer(200, 100, 86)).mul(collapse).mul(0.8))
    this.colorNode = color(hsl.integer(312, 100, 2.4))
    this.roughness = 0.05
    this.metalness = 0.2
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.8
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = probability.mul(300).add(100)
    this.emissiveNode = quantum.mul(probability).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(338, 100, 67)).mul(collapse).mul(intimate).mul(0.6)).add(color(hsl.integer(203, 99, 89.6)).mul(rim).mul(0.4))
    this.opacityNode = probability.mul(0.55).add(collapse.mul(0.3)).add(intimate.mul(0.15)).clamp()
  }
}
