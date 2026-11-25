import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, vec2, vec3} from 'three/tsl'

import {breath} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {resolved, stroke, torusNoise} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import ReliefKnotMaterial, {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** An ivory mycelial symbiosis: thick living cords, finer hyphae, felted moss and translucent spore sacs. */
export default class extends ReliefKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = data.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const baseNormal = this.sculpt(tube => torusNoise(tube, 4, 1.5, 4).mul(0.0038)
      .add(tube.x.mul(TAU * 3).add(breath).sin().mul(0.00065)))
    const warp = mx_noise_vec3(p.mul(4).add(11)).mul(0.7).toVar()
    const rootSpace = p.mul(8).add(warp)
    const boundary = cellularBoundary(rootSpace).toVar()
    const roots = stroke(boundary, 0.055, boundary.fwidth()).toVar()
    const rootCore = stroke(boundary, 0.018, boundary.fwidth()).toVar()
    const habitat = mx_noise_float(p.mul(3).add(24)).mul(0.5).add(0.5).toVar()
    const hyphaField = mx_noise_float(p.mul(27).add(warp)).toVar()
    const hyphae = stroke(hyphaField, 0.024, hyphaField.fwidth())
      .mul(habitat.smoothstep(0.3, 0.7)).mul(resolved(p.mul(27))).mul(roots.oneMinus()).toVar()
    const spores = beads(p.mul(23).add(9.1), 7.3)
    const sacs = spores.mask.mul(habitat.smoothstep(0.34, 0.7)).mul(near.mul(0.35).add(0.65)).toVar()
    const fineCoordinates = p.mul(190)
    const felt = mx_noise_float(fineCoordinates).mul(resolved(fineCoordinates)).toVar()
    const moss = mix(color(hsl.integer(174, 26, 14)), color(hsl.integer(99, 30, 31)), habitat)
      .mul(felt.mul(0.1).add(0.95))
    const ivory = mix(color(hsl.integer(81, 39, 47)), color(hsl.integer(94, 37, 80)), rootCore.mul(0.65).add(habitat.mul(0.35)))
    let tissue = mix(moss, ivory, roots.mul(0.9))
    tissue = mix(tissue, color(hsl.integer(90, 37, 71)), hyphae.mul(0.65))
    tissue = mix(tissue, mix(color(hsl.integer(39, 53, 41)), color(hsl.integer(79, 56, 85.5)), spores.random.x), sacs)
    const pumping = p.dot(vec3(7, -4, 11)).add(breath).sin().mul(0.5).add(0.5).pow(5).toVar()
    const sap = mix(color(hsl.integer(63, 82, 62)), color(hsl.integer(96, 100, 94.5)), pumping)
    this.colorNode = tissue
    this.metalness = 0.04
    this.roughnessNode = mix(float(0.87).add(felt.mul(0.025)), float(0.48), roots)
      .mix(0.29, sacs).clamp(0.24, 0.94)
    const rootHeight = roots.pow(0.8).mul(0.0016).add(rootCore.mul(0.00045))
      .add(hyphae.mul(0.00025)).add(spores.cap.mul(sacs).mul(0.0021))
      .add(felt.mul(0.000035)).add(sacs.mul(pumping).mul(0.00018))
    this.normalNode = engravedNormal(baseNormal, rootHeight, 0.8)
    this.clearcoat = 0.3
    this.clearcoatNode = sacs.mul(0.5).add(roots.mul(0.1))
    this.clearcoatRoughnessNode = sacs.mul(-0.15).add(0.32)
    this.sheen = 0.4
    this.sheenNode = color(hsl.integer(112, 34, 53)).mul(roots.oneMinus()).mul(0.4)
    this.sheenRoughness = 0.8
    this.specularIntensity = 0.55
    this.emissiveNode = sap.mul(sacs).mul(pumping.mul(1.1).add(0.08))
      .add(color(hsl.integer(70, 76, 62)).mul(rootCore).mul(pumping).mul(0.16))
      .add(color(hsl.integer(106, 44, 74)).mul(hyphae).mul(grazing.pow(3)).mul(intimate).mul(0.035))
      .mul(facing.mul(0.45).add(0.55))
    this.aoNode = roots.mul(0.2).add(sacs.mul(0.07)).add(0.73).clamp()
    this.anisotropy = 0.15
    this.anisotropyNode = vec2(1, 0).mul(roots).mul(0.15)
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'peristaltic fungal biophotons',
    }
  }
}
