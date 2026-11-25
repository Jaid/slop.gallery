import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalView, positionViewDirection, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A dark soap film. Thickness is a slow landscape, so interference color slides as you circle, and the grazing rim goes almost white. The membrane stays transmissive rather than metallic. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.05)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate, view} = viewerFrame()
    const drift = time.mul(0.05)
    const thick = mx_noise_float(p.mul(1.8).add(vec3(drift, 0, drift.mul(0.4)))).mul(0.5).add(0.5)
    const fine = mx_noise_float(p.mul(5.5).add(drift)).mul(0.5).add(0.5)
    const incidence = normalView.dot(positionViewDirection).abs().clamp(0.08, 1)
    const path = thick.mul(0.85).add(fine.mul(0.15)).add(0.05).div(incidence.pow(0.7))
    const order = path.mul(5.5).add(view.y.mul(near.mul(1.4).add(0.4)))
    const fringe = vec3(order, order.add(2.0944), order.add(4.1888)).mul(1.15).cos().mul(0.5).add(0.5)
    const second = vec3(order.mul(1.8).add(1), order.mul(1.8).add(3), order.mul(1.8).add(5)).cos().mul(0.5).add(0.5)
    const film = mix(fringe, second, intimate.mul(0.6).add(grazing.mul(0.3)))
    const black = thick.smoothstep(0.28, 0.06)
    const filmColor = mix(film, color(hsl.integer(271, 21, 4)), black.mul(0.72))
    this.colorNode = filmColor
    this.metalness = 0
    this.roughness = 1
    this.transmissionNode = float(0.08).add(grazing.mul(0.1))
    this.thicknessNode = float(0.2).add(thick.mul(0.5))
    this.ior = 1.4
    this.dispersionNode = float(1.3).add(near.mul(0.5))
    this.attenuationColor.set(hsl.integer(230, 100, 85))
    this.attenuationDistance = 0.45
    this.iridescence = 1
    this.iridescenceIOR = 1.2
    this.iridescenceThicknessNode = float(60).add(path.mul(640))
    this.clearcoat = 0
    this.normalNode = liquidNormal(float(0.35), 0.4)
    this.emissiveNode = filmColor.mul(grazing.mul(0.4).add(0.25))
      .add(color(hsl.integer(0, 0, 100)).mul(grazing.pow(5)).mul(0.7))
      .add(film.mul(facing).mul(0.12))
  }
}
