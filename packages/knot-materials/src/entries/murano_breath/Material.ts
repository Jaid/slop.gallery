import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Venetian glass that never cooled: amber and lagoon swirls turn at three depths inside the tube, trapped bubbles rise toward the light, and every step around it stirs the colors into a new pour. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
    const swirlAt = (depth: number) => {
      const q = p.sub(view.mul(depth))
      const warp = mx_noise_float(q.mul(4.2).add(depth * 17))
      const band = opticalBands(q.dot(vec3(5, 8, 3)).add(warp.mul(3.4)))
      return {
        band,
        q,
      }
    }
    const outer = swirlAt(0.02)
    const middle = swirlAt(0.11)
    const inner = swirlAt(0.2)
    const amber = color(hsl.integer(62, 100, 74))
    const lagoon = color(hsl.integer(182, 95, 66))
    const glassTint = mix(
      mix(amber, lagoon, outer.band),
      mix(lagoon, color(hsl.integer(90, 100, 93)), inner.band),
      0.45,
    ).mul(1.12)
    const trapped = beads(p.mul(24), 5.1)
    this.colorNode = mix(glassTint, color(hsl.integer(90, 100, 97)), trapped.mask.mul(0.35))
    this.transmission = 0.84
    this.thickness = 0.7
    this.ior = 1.52
    this.dispersion = 0.4
    this.attenuationColor.set(hsl.integer(179, 68, 73))
    this.attenuationDistance = 0.8
    this.metalness = 0
    this.roughnessNode = float(0.05).add(trapped.mask.mul(0.14)).add(grazing.mul(0.03))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.22
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = middle.band.mul(180).add(220)
    const glassNormal = proceduralNormal(trapped.cap.mul(trapped.core).mul(0.7).add(middle.band.mul(0.12)), 0.8)
    this.normalNode = glassNormal
    this.emissiveNode = mix(amber, lagoon, inner.band)
      .mul(grazing.pow(2.5).mul(0.18).add(0.09))
      .add(color(hsl.integer(92, 100, 96)).mul(glints(glassNormal, 130)).mul(trapped.mask).mul(near.mul(0.9).add(0.2)))
  }
}
