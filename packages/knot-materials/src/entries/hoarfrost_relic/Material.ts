import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Winter taking a dark stone. Frost does not fall evenly here: it creeps in branching dendrites over the upward faces, thickens into druzy crystals in the hollows and leaves the polished night-stone bare in between. From across the room it reads as white lace on slate; only a close visitor earns the individual crystals, which answer the gallery lights one facet at a time. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, grazing, rim, objectDistance} = viewerFrame()
    const close = objectDistance.smoothstep(1.5, 4.8).oneMinus()
    const intimate = objectDistance.smoothstep(1.15, 3.1).oneMinus()
    const upward = normalLocal.y.mul(0.5).add(0.5)
    const growth = mx_fractal_noise_float(p.mul(2.8).add(vec3(4.7, 9.1, 2.3)), 3, 2.02, 0.52).mul(0.5).add(0.5)
    const breath = time.mul(0.021).sin().mul(0.018)
    const frostField = growth.mul(0.76).add(upward.mul(0.2)).add(breath)
    const frost = frostField.smoothstep(0.52, 0.7)
    const frostReach = frostField.smoothstep(0.4, 0.58)
// Dendrites at two scales: broad creeping branches, then a finer lace revealed by proximity.
    const warp = mx_noise_float(p.mul(2.2).add(vec3(8.8, 1.4, 5.5)))
    const branchField = mx_noise_float(p.mul(5.6).add(warp.mul(1.25)).add(vec3(3.1)))
    const branch = filament(branchField, 0.018).mul(frostReach)
    const fineBranch = filament(mx_noise_float(p.mul(13.5).sub(warp.mul(1.7)).add(vec3(12.7))), 0.012).mul(intimate).mul(frostReach)
    const crystals = beads(p.mul(27), 3.1)
    const microCrystals = beads(p.mul(61), 11.4)
    const crystalMask = crystals.mask.mul(frost.mul(0.75).add(branch.mul(0.35)).clamp())
    const microMask = microCrystals.mask.mul(intimate).mul(frost.mul(0.65).add(fineBranch.mul(0.4)).clamp())
    const coverage = frost.mul(0.82).max(branch.mul(0.72)).max(fineBranch.mul(0.6)).max(crystalMask).clamp()
// Sculptural relief stays free of screen-space derivatives: constant-width branches and the beads' raw caps,
// while the pixel-filtered masks above are reserved for color and sparkle in the fragment.
    const branchRelief = branchField.abs().smoothstep(0.015, 0.075).oneMinus()
    const frostHeight = frost.mul(0.0038).add(branchRelief.mul(0.0016)).add(crystals.core.mul(crystals.cap).mul(0.0045)).add(microCrystals.core.mul(microCrystals.cap).mul(0.0016).mul(intimate))
    this.positionNode = p.add(normalLocal.mul(frostHeight))
    const frostNormal = proceduralNormal(frostHeight, 1.08)
    this.normalNode = frostNormal
    this.clearcoatNormalNode = frostNormal
    const slate = color(hsl.integer(260, 37, 6))
    const wetSlate = color(hsl.integer(256, 46, 14))
    const frostWhite = color(hsl.integer(244, 100, 97))
    const glacier = color(hsl.integer(233, 62, 83))
    const stoneNoise = mx_noise_float(p.mul(9.5)).mul(0.5).add(0.5)
    let surface = mix(slate, wetSlate, stoneNoise)
    surface = mix(surface, mix(glacier, frostWhite, crystals.random.x.mul(0.45).add(0.35)), coverage)
    surface = mix(surface, color(hsl.integer(0, 0, 100)), microMask.mul(0.55))
    this.colorNode = surface
    this.metalnessNode = coverage.mul(0.04)
    this.roughnessNode = mix(float(0.46), float(0.34), coverage).sub(crystalMask.mul(0.13)).clamp(0.18, 0.55)
    this.clearcoatNode = coverage.oneMinus().mul(0.68).add(crystalMask.mul(0.22))
    this.clearcoatRoughness = 0.075
    this.iridescenceNode = coverage.mul(grazing).mul(0.26)
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = facing.mul(170).add(120)
    this.sheen = 0.36
    this.sheenColor.set(hsl.integer(241, 100, 91))
    this.sheenRoughness = 0.48
    this.aoNode = frost.mul(-0.1).add(1)
    const facetTwinkle = time.mul(crystals.random.y.mul(2.4).add(0.7)).add(crystals.random.z.mul(39)).sin().mul(0.5).add(0.5)
    const crystalGlint = glints(frostNormal, 290)
    this.emissiveNode = color(hsl.integer(234, 100, 96.4)).mul(crystalMask).mul(crystalGlint).mul(facetTwinkle.mul(0.8).add(0.45)).mul(close.mul(1.2).add(0.35)).mul(2.4)
      .add(color(hsl.integer(0, 0, 100)).mul(microMask).mul(glints(frostNormal, 340)).mul(intimate).mul(2))
      .add(color(hsl.integer(241, 100, 77)).mul(coverage).mul(rim).mul(0.14))
      .add(color(hsl.integer(230, 100, 90)).mul(fineBranch).mul(intimate).mul(0.16))
      .add(color(hsl.integer(256, 57, 19)).mul(facing.oneMinus()).mul(0.1))
  }
}
