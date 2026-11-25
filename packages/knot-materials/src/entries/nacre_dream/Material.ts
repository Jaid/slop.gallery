import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Nacre is built from quiet growth layers; angle turns the quiet into color. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const drift = p.mul(2.05).add(vec3(time.mul(0.012), time.mul(-0.008), time.mul(0.01)))
    const fold = mx_fractal_noise_float(drift, 4, 2.05, 0.55)
    const layerPhase = p.dot(vec3(5.3, 2.1, 7.4)).add(fold.mul(3.4))
    const layer = layerPhase.sin().mul(0.5).add(0.5)
    const lamina = layerPhase.mul(7.5).sin().abs().pow(0.4)
    const laminaFoot = layerPhase.mul(7.5).fwidth().max(0.001)
    const resolved = laminaFoot.smoothstep(0.55, 1.8).oneMinus()
    const anglePhase = view.dot(vec3(0.8, 0.25, -0.55)).mul(2.5).add(layer.mul(0.5)).add(time.mul(0.01))
    const interference = spectralColor(anglePhase)
    const body = mix(color(hsl.integer(218, 69, 32)), color(hsl.integer(347, 48, 34)), layer.mul(0.58))
    const nacre = mix(body, interference, 0.5).add(color(hsl.integer(72, 56, 87)).mul(grazing.mul(0.12)))
    const nacreHeight = layer.mul(0.16).add(lamina.mul(resolved).mul(0.05))
    const nacreNormal = proceduralNormal(nacreHeight, 0.002)
    const fire = glints(nacreNormal, 68).mul(near).mul(0.2)
    const shellGlint = glints(nacreNormal, 17).mul(facing.mul(0.4).add(0.6)).mul(0.06)
    this.colorNode = nacre.add(interference.mul(fire.add(shellGlint)))
    this.metalness = 0.04
    this.roughnessNode = float(0.2).add(layer.mul(0.1)).sub(facing.mul(0.04)).clamp(0.1, 0.38)
    this.clearcoat = 0.82
    this.clearcoatRoughness = 0.065
    this.iridescence = 0.9
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = layer.mul(240).add(lamina.mul(90)).add(190)
    this.normalNode = nacreNormal
    this.clearcoatNormalNode = nacreNormal
    this.emissiveNode = interference.mul(fire.mul(0.08)).add(color(hsl.integer(86, 100, 96)).mul(grazing.pow(4).mul(0.03)))
  }
}
