import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {hairline} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function ember(t: Node<'float'>) {
  const c = t.clamp()
  const low = mix(color(hsl.integer(39, 100, 6)), color(hsl.integer(36.4, 100, 61)), c.mul(2).clamp())
  return mix(low, color(hsl.integer(95, 100, 94.6)), c.sub(0.5).mul(2).clamp().pow(1.4))
}

/** Folded, brushed damascus steel, still cooling from the forge. Temper colours bloom around fissures; embers deep in the cracks breathe faster and brighter the closer you come. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const fold = mx_noise_float(p.mul(2.6)).mul(5).add(mx_noise_float(p.mul(7.5).add(vec3(3.1, 7.7, 1.3))).mul(1.6))
    const layerPhase = p.y.mul(38).add(tube.x.mul(Math.PI * 6).sin().mul(2)).add(fold)
    const layers = layerPhase.sin().mul(0.5).add(0.5)
    const bright = layers.smoothstep(0.35, 0.65)
    const etch = hairline(layerPhase.sin(), 0.08)
    const fissureField = mx_fractal_noise_float(p.mul(3.4).add(vec3(0, time.mul(0.02), 0)), 3, 2.1, 0.55)
    const fissureWidth = mx_noise_float(p.mul(5)).mul(0.5).add(0.5).mul(0.05).add(0.012)
    const fissure = fissureField.abs().div(fissureWidth.max(fissureField.fwidth().mul(1.5))).oneMinus().clamp().pow(1.5)
    const temper = fissureField.abs().smoothstep(0.02, 0.28).oneMinus()
    const inner = p.sub(view.mul(0.03))
    const emberNoise = mx_noise_float(inner.mul(9).add(vec3(0, time.mul(-0.25), 0))).mul(0.5).add(0.5)
    const pulse = tube.x.mul(Math.PI * 2 * 5).sub(time.mul(1.1)).sin().mul(0.5).add(0.5).pow(3)
    const heat = fissure.mul(emberNoise.mul(0.6).add(0.4)).mul(pulse.mul(0.6).add(0.4)).mul(near.mul(0.75).add(0.25))
    const steel = mix(color(hsl.integer(254, 12, 36)), color(hsl.integer(252, 15, 85)), bright).mul(etch.mul(0.5).oneMinus())
    const scorched = mix(steel, color(hsl.integer(350, 20, 10)), temper.mul(0.55))
    this.colorNode = mix(scorched, color(hsl.integer(38, 82, 10)), fissure)
    this.metalnessNode = fissure.mul(0.6).oneMinus()
    this.roughnessNode = float(0.22).mix(0.42, bright.oneMinus()).add(temper.mul(0.15)).add(fissure.mul(0.3))
    this.anisotropy = 1
    const brushAngle = mx_noise_float(p.mul(4)).mul(0.25).add(layers.mul(0.2))
    this.anisotropyNode = vec2(brushAngle.cos(), brushAngle.sin()).mul(bright.mul(0.35).add(0.55)).mul(fissure.oneMinus())
    this.iridescence = 1
    this.iridescenceNode = temper.mul(fissure.oneMinus()).mul(0.9)
    this.iridescenceIOR = 1.8
    this.iridescenceThicknessNode = temper.mul(-260).add(620)
    this.normalNode = proceduralNormal(bright.mul(0.6).sub(fissure.mul(1.2)).add(mx_noise_float(p.mul(30)).mul(0.08)), 0.0012)
    this.emissiveNode = ember(heat.mul(1.3)).mul(heat).mul(3.2)
      .add(color(hsl.integer(43, 100, 65.3)).mul(temper).mul(near).mul(pulse).mul(0.06))
      .add(color(hsl.integer(52, 99, 71)).mul(grazing.pow(4)).mul(intimate).mul(0.04))
  }
}
