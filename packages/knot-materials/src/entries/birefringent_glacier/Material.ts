import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.2))
    const stress = mx_fractal_noise_float(inner.mul(4.6), 4, 2, 0.52)
    const cracks = opticalLine(stress.mul(6.5).sin(), 0.05).add(opticalLine(mx_noise_float(inner.mul(9.5)).mul(14).sin(), 0.04).mul(0.7))
    const polar = normalViewGeometry.cross(view).length().clamp()
    const slow = spectralColor(stress.mul(5).add(polar.mul(3.2)).add(view.x.mul(2)))
    const fast = spectralColor(stress.mul(5).add(polar.mul(3.2)).add(2.094).add(view.y.mul(1.5)))
    const biref = mix(slow, fast, polar.mul(0.65).add(grazing.mul(0.35)))
    const bubbles = cellularPoints(inner.mul(28), 0.08, 0.24, 0.4)
    const caustic = mx_noise_float(vec3(p.x.mul(9), p.y.mul(2).add(time.mul(0.18)), p.z.mul(9)))
      .mul(7)
      .sin()
      .abs()
      .pow(4)
    const frostField = mx_noise_float(p.mul(20)).abs()
    const dendrite = frostField
      .smoothstep(0.09, 0)
      .mul(mx_noise_float(p.mul(8.5)).abs().smoothstep(0.28, 0.04))
    const frost = dendrite.mul(near.pow(1.35)).mul(intimate.mul(0.45).add(0.55))
    const ice = mix(color(hsl.integer(240, 52, 12)), color(hsl.integer(234, 75, 92.6)), facing.mul(0.35).add(0.1))
    this.colorNode = mix(mix(ice, biref, cracks.mul(0.45).add(0.2)), color(hsl.integer(251, 100, 96.5)), frost.mul(0.85))
    this.transmissionNode = frost.oneMinus().mul(0.55).add(0.4).mul(facing.mul(0.2).add(0.78))
    this.thickness = 0.7
    this.ior = 1.31
    this.dispersion = 0.5
    this.attenuationColor.set(hsl.integer(226, 62, 76))
    this.attenuationDistance = 0.55
    this.roughnessNode = frost.mul(0.38).add(0.02)
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughnessNode = frost.mul(0.22).add(0.02)
    this.iridescence = 0.45
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = polar.mul(180).add(220)
    this.normalNode = liquidNormal(near.mul(0.4).add(frost.mul(1.4)), 0.16)
    this.emissiveNode = biref
      .mul(cracks)
      .mul(near.mul(0.6).add(0.3))
      .mul(0.85)
      .add(color(hsl.integer(229, 100, 92.3)).mul(bubbles).mul(intimate).mul(1.3))
      .add(color(hsl.integer(237, 100, 81.3)).mul(caustic).mul(facing).mul(0.22))
      .add(color(hsl.integer(232, 100, 98)).mul(frost).mul(glints(normalViewGeometry, 80)).mul(0.6))
      .add(color(hsl.integer(233, 44, 49)).mul(rim).mul(0.12))
  }
}
