import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {ridge} from '../../candidates/claude_fable/lib/ridge.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A lightning strike frozen inside a block of amber acrylic. Four parallax strata of branching discharge lie at different depths, so the tree shifts as you circle it; the closer you stand, the more often a surge runs the branches again. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
    const bolt = (q: Node<'vec3'>, seed: number) => {
      const warp = mx_noise_float(q.mul(1.7).add(seed)).mul(0.35)
      const trunkField = mx_noise_float(q.mul(2.4).add(vec3(warp, seed, warp.negate())))
      const trunk = ridge(trunkField, 0.012)
      const branchField = mx_noise_float(q.mul(6.5).add(trunkField.mul(0.8)).add(seed * 1.7))
      const branch = ridge(branchField, 0.006).mul(trunkField.abs().smoothstep(0.03, 0.32).oneMinus())
      const twigField = mx_noise_float(q.mul(16).add(branchField.mul(0.6)).add(seed * 2.3))
      const twig = ridge(twigField, 0.004).mul(branchField.abs().smoothstep(0.02, 0.18).oneMinus()).mul(trunkField.abs().smoothstep(0.05, 0.4).oneMinus())
      const halo = trunkField.abs().smoothstep(0, 0.12).oneMinus()
      const phase = q.y.mul(9).add(trunkField.mul(4)).add(seed)
      return {
        trunk,
        branch,
        twig,
        halo,
        phase,
      }
    }
    let lightning: Node<'vec3'> = vec3(0)
    const depths = [0.03, 0.08, 0.14, 0.21]
    for (const [i, depth] of depths.entries()) {
      const q = p.sub(view.mul(depth))
      const {trunk, branch, twig, halo, phase} = bolt(q, i * 13.7 + 2.1)
      const flicker = mx_noise_float(vec3(time.mul(1.9).add(i * 5.3), i * 3.1, time.mul(0.7)))
      const gate = flicker.smoothstep(near.mul(-0.3).add(0.42), near.mul(-0.3).add(0.6))
      const surge = phase.sub(time.mul(2.2)).sin().mul(0.5).add(0.5).pow(6).mul(gate)
      const energy = surge.mul(2.5).add(0.18)
      const shape = trunk.add(branch.mul(0.7)).add(twig.mul(0.45))
      const core = trunk.pow(3).add(branch.pow(3).mul(0.6))
      const depthFade = 1 - i * 0.18
      lightning = lightning
        .add(mix(color(hsl.integer(270, 100, 62)), color(hsl.integer(265, 100, 98)), core).mul(shape).mul(energy).mul(depthFade))
        .add(color(hsl.integer(292, 100, 54)).mul(halo).mul(surge).mul(0.25 * depthFade))
    }
    this.colorNode = color(hsl.integer(51, 86, 25))
    this.transmission = 0.9
    this.thickness = 0.45
    this.ior = 1.49
    this.dispersion = 0.15
    this.attenuationColor.set(hsl.integer(61, 87, 57))
    this.attenuationDistance = 0.7
    this.roughness = 0.02
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(11)).mul(0.2), 0.0006)
    this.emissiveNode = lightning.mul(near.mul(0.6).add(0.45)).add(color(hsl.integer(62, 100, 74)).mul(grazing.pow(3)).mul(0.08))
  }
}
