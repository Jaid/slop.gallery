import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, vec3} from 'three/tsl'

import {dendriticField} from '../../candidates/grok/lib/dendriticField.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.08))
    const fern = dendriticField(inner, 9)
    const lattice = dendriticField(inner.mul(1.4).add(vec3(4.2, -2.8, 1.1)), 19)
    const bloom = mx_noise_float(p.mul(5.5)).smoothstep(0.15, 0.62)
    const ridge = opticalLine(fern.mul(7.5), 0.042)
    const crystal = opticalLine(lattice.mul(10), 0.03).mul(intimate.add(0.25))
    const facet = mx_cell_noise_float(p.mul(14)).mul(0.5).add(mx_cell_noise_float(p.mul(28)).mul(0.5))
    const sparkle = glints(normalViewGeometry.add(mx_noise_vec3(p.mul(20)).sub(0.5).mul(0.35)).normalize(), 140)
      .mul(crystal.add(ridge.mul(0.4)))
      .mul(intimate.mul(0.6).add(0.4))
    const iceBody = mix(color(hsl.integer(232, 31, 71)), color(hsl.integer(238, 100, 97)), bloom.mul(0.55).add(facing.mul(0.25)))
    const rime = mix(iceBody, color(hsl.integer(0, 0, 100)), ridge.add(crystal).clamp())
    this.colorNode = rime
    this.metalness = 0.05
    this.roughnessNode = float(0.22).sub(ridge.mul(0.12)).sub(sparkle.mul(0.08)).max(0.03)
    this.transmission = 0.62
    this.thickness = 0.55
    this.ior = 1.31
    this.dispersion = 0.55
    this.attenuationColor.set(hsl.integer(232, 36, 77))
    this.attenuationDistance = 0.4
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.iridescence = 0.35
    this.iridescenceIOR = 1.18
    this.iridescenceThicknessNode = fern.mul(160).add(240)
    this.normalNode = proceduralNormal(fern.mul(0.6).add(facet.mul(0.25)).add(crystal.mul(0.4)), 0.007)
    this.emissiveNode = color(hsl.integer(229, 100, 93.7))
      .mul(ridge.add(crystal.mul(0.8)))
      .mul(0.18)
      .mul(near.mul(0.5).add(0.35))
      .add(mix(color(hsl.integer(89, 100, 96.3)), color(hsl.integer(245, 100, 86.5)), facing).mul(sparkle).mul(1.6))
      .add(color(hsl.integer(236, 32, 64)).mul(grazing.pow(2)).mul(0.08))
      .add(color(hsl.integer(236, 100, 96)).mul(rim).mul(0.05))
  }
}
