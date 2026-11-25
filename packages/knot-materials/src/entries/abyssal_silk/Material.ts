import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function silkField(point: Node<'vec3'>, tube: Node<'vec2'>) {
  const drift = vec3(time.mul(0.012), time.mul(-0.009), time.mul(0.006))
  const broad = mx_fractal_noise_float(point.mul(2.15).add(drift), 4, 2.08, 0.55)
  const counter = mx_fractal_noise_float(point.mul(4.8).sub(drift.mul(1.7)), 2, 2.2, 0.48)
  const flow = point.mul(5.4).add(vec3(broad.mul(0.8), counter.mul(0.44), broad.mul(-0.35)))
  const ribbonPhase = flow.x.mul(2.2).add(flow.y.mul(1.35)).add(flow.z.mul(-0.8)).add(counter.mul(2.6))
  const ribbon = ribbonPhase.sin().mul(0.5).add(0.5)
  const secondary = flow.y.mul(3.1).add(flow.z.mul(1.9)).sub(broad.mul(1.7)).sin().mul(0.5).add(0.5)
  // Whole cycles close both UV wraps; filter the unwrapped phase before taking its sine.
  const threadPhase = tube.x.mul(TAU * 99).add(tube.y.mul(TAU * 6)).add(broad.mul(9))
  const threadPhaseTwo = tube.x.mul(TAU * 148).sub(tube.y.mul(TAU * 10)).add(counter.mul(12))
  const thread = threadPhase.sin().mul(threadPhase.fwidth().smoothstep(0.6, 3).oneMinus()).mul(0.5).add(threadPhaseTwo.sin().mul(threadPhaseTwo.fwidth().smoothstep(0.6, 3).oneMinus()).mul(0.28))
  const fleck = mx_noise_float(point.mul(38).add(drift.mul(4))).mul(0.5).add(0.5)
  return {
    broad,
    counter,
    fleck,
    ribbon,
    secondary,
    thread,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const silk = silkField(p, tube)
    const viewShift = view.mul(0.075)
    const rear = mx_fractal_noise_float(p.sub(viewShift).mul(3.05).add(vec3(0, time.mul(0.006), 0)), 3, 2.1, 0.52)
    const angle = facing.mul(2.5).add(grazing.mul(-1.1)).add(view.x.mul(0.55)).add(silk.broad.mul(0.65))
    const spectral = cosinePalette(angle, [0.38, 0.28, 0.56], [0.5, 0.42, 0.42], [1, 1, 1], [0.02, 0.3, 0.62])
    const violet = mix(color(hsl.integer(287, 62, 9)), color(hsl.integer(312, 71, 24)), silk.ribbon.pow(1.7).mul(0.8).add(0.1))
    const blue = mix(color(hsl.integer(256, 71, 12)), color(hsl.integer(216, 91, 37)), silk.secondary.pow(1.5).mul(0.72).add(0.08))
    const cloth = mix(violet, blue, silk.secondary.mul(0.65)).add(spectral.mul(silk.ribbon.mul(0.18).add(silk.thread.mul(0.11))))
    this.colorNode = cloth
    this.metalness = 0.04
    this.roughnessNode = float(0.27).add(silk.thread.abs().mul(0.11)).sub(silk.ribbon.mul(0.06)).add(rear.mul(0.04))
    this.sheen = 0.92
    this.sheenRoughness = 0.2
    this.sheenColor.set(hsl.integer(301, 100, 74.5))
    this.anisotropy = 0.78
    this.anisotropyNode = vec2(0.24, 0.97)
    this.clearcoat = 0.22
    this.clearcoatRoughnessNode = float(0.13).add(silk.thread.abs().mul(0.07))
    this.transmission = 0.08
    this.thickness = 0.36
    this.ior = 1.46
    this.iridescenceNode = silk.ribbon.mul(0.56).add(silk.secondary.mul(0.18))
    this.iridescenceThicknessNode = facing.mul(460).add(silk.broad.mul(290)).add(210)
    this.normalNode = proceduralNormal(silk.ribbon.mul(0.0022).add(silk.thread.mul(0.00065)).add(silk.fleck.mul(0.00018)), 0.0027)
    this.emissiveNode = spectral.mul(silk.ribbon.pow(5).mul(0.22).mul(grazing.mul(0.6).add(0.25)).mul(near.mul(0.38).add(0.62))).add(color(hsl.integer(300, 100, 88)).mul(silk.thread.abs().mul(0.08).mul(intimate.mul(0.42).add(0.2)))).add(color(hsl.integer(226, 100, 81)).mul(grazing.mul(0.075)))
  }
}
