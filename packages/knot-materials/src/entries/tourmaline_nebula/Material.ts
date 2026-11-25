import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, normalViewGeometry, time, uv, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function crystalField(tube: Node<'vec2'>) {
  // Whole cycles close the shared crystal field in both vertex and fragment stages.
  const facet = tube.x.mul(TAU * 3).add(tube.y.mul(TAU).sin().mul(0.4))
  const ridge = facet.sin().mul(0.5).add(0.5)
  const seam = facet.sin().abs().smoothstep(0.04, 0.18).oneMinus()
  const chatter = tube.x.mul(TAU * 22).add(tube.y.mul(TAU * 3).sin()).sin().mul(0.5).add(0.5)
  return {
    facet,
    ridge,
    seam,
    chatter,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const field = crystalField(tube)
    const nebula = mx_fractal_noise_float(p.mul(3.4).add(vec3(time.mul(0.012), 0, 0)), 4, 2.1, 0.55).mul(0.5).add(0.5)
    const angle = view.dot(vec3(0.32, 0.42, 0.85).normalize()).mul(0.5).add(0.5)
    const inclusions = starfield(view, 32, 0.972)
    const crystal = mix(color(hsl.integer(294, 53, 3.5)), color(hsl.integer(287, 76, 14)), nebula.mul(0.64))
    const edge = mix(color(hsl.integer(296, 91, 39)), color(hsl.integer(183, 88, 77)), angle)
    const height = field.seam.mul(0.018).add(field.chatter.mul(0.004))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.5).add(0.5)).mul(0.0014)))
    this.colorNode = mix(crystal, edge, field.seam.mul(0.62).add(field.ridge.mul(0.16)))
    this.metalness = 0.18
    this.roughnessNode = float(0.09).add(field.chatter.mul(0.1)).add(field.seam.mul(0.14)).clamp(0.045, 0.3)
    this.transmission = 0.34
    this.thickness = 0.9
    this.ior = 1.62
    this.dispersion = 0.36
    this.attenuationColor.set(hsl.integer(292, 86, 36))
    this.attenuationDistance = 1.35
    this.clearcoat = 0.86
    this.clearcoatRoughness = 0.035
    this.normalNode = proceduralNormal(height.mul(1.4), 0.0011)
    this.iridescenceNode = field.ridge.mul(0.48).add(grazing.mul(0.26))
    this.iridescenceIOR = 1.36
    this.iridescenceThicknessNode = angle.mul(330).add(field.ridge.mul(90)).add(90)
    const reflection = glints(normalViewGeometry, 125).mul(field.seam).mul(near)
    this.emissiveNode = edge.mul(field.seam.mul(grazing).mul(near).mul(0.18)).add(inclusions.mul(1.8).mul(intimate.mul(0.75).add(0.25))).add(color(hsl.integer(311, 100, 85)).mul(reflection.mul(0.4)))
    this.aoNode = float(0.74).add(field.ridge.mul(0.26))
  }
}
