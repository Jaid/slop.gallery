import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {fractalNoise} from '../../candidates/grok/lib/fractalNoise.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A soap film stretched over the knot. Thickness is a slow draining landscape, so interference runs from near-black through spectral bands into gold as you orbit. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.45)
    this.name = knotData.id
    const {p, view, facing, grazing, near, distance} = viewerFrame()
    const drain = fractalNoise(p.mul(1.7).add(vec3(0, time.mul(0.06), 0)), 4, 2.05, 0.55)
    const swirl = mx_noise_float(p.mul(4.2).add(view.mul(1.8)).add(time.mul(0.09))).mul(0.5).add(0.5)
    const gravity = p.y.mul(1.1).add(0.55)
    const thickness = drain.mul(0.5).add(swirl.mul(0.28)).add(gravity.smoothstep(-0.2, 0.8).mul(0.28)).clamp(0, 1)
    const thin = thickness.smoothstep(0.22, 0.02)
    const thick = thickness.smoothstep(0.62, 0.95)
    const angleShift = view.dot(vec3(0.15, 0.9, 0.4)).mul(0.55).add(grazing.mul(1.35))
    const hue = spectralColor(thickness.mul(11).add(angleShift).add(time.mul(0.08)))
    const black = color(hsl.integer(293, 27, 4.4))
    const gold = color(hsl.integer(88, 80, 85.6))
    const film = mix(mix(black, hue, thickness.smoothstep(0.04, 0.22)), gold, thick.mul(0.55))
    this.colorNode = mix(film, color(hsl.integer(255, 100, 98.5)), thin.mul(facing).mul(0.08))
    this.metalness = 0
    this.roughnessNode = float(0.02).add(thin.mul(0.015))
    this.iorNode = float(1.34).add(thickness.mul(0.08))
    this.transmissionNode = float(0.62).add(thin.mul(0.28)).sub(thick.mul(0.22)).clamp(0.4, 0.92)
    this.thicknessNode = thickness.mul(0.2).add(0.015)
    this.attenuationColorNode = mix(color(hsl.integer(80, 100, 97.5)), hue, float(0.55))
    this.attenuationDistance = 0.55
    this.dispersionNode = thickness.mul(0.85).add(grazing.mul(0.35)).add(0.08)
    this.iridescence = 1
    this.iridescenceIORNode = float(1.12).add(grazing.mul(0.4))
    this.iridescenceThicknessNode = thickness.mul(920).add(30).add(distance.mul(30)).add(angleShift.mul(80))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.012).add(swirl.mul(0.025))
    this.normalNode = liquidNormal(thickness.mul(0.7).add(near.mul(0.4)).add(0.25), thickness.mul(0.85).add(0.35))
    this.clearcoatNormalNode = liquidNormal(float(0.25), float(0.2))
    const rimLight = grazing.pow(1.35)
    this.emissiveNode = hue.mul(rimLight).mul(0.55).add(hue.mul(thickness.smoothstep(0.2, 0.55)).mul(facing).mul(0.12)).add(gold.mul(thick).mul(facing).mul(0.1)).add(color(hsl.integer(0, 0, 100)).mul(thin).mul(rimLight).mul(0.12))
  }
}
