import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Dense velvet is deliberately almost lightless head-on. At a glancing angle its individual nap becomes a field of colored crescents, as though a small eclipse is embedded in every fold. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {grazing, intimate, near, p, view} = viewerFrame()
    const napAxis = vec3(0.61, -0.42, 0.67).normalize()
    const crossNapAxis = vec3(-0.34, 0.87, 0.35).normalize()
    const napPhase = p.dot(napAxis).mul(82).add(p.dot(crossNapAxis).mul(17))
    const nap = opticalBands(napPhase)
    const napDirection = view.dot(napAxis).mul(0.5).add(0.5)
    const grain = mx_noise_float(p.mul(31)).mul(0.5).add(0.5)
    // Compact occluded rings form a shallow embedded layer whose edge shifts at intimate range.
    const moonSpace = p.mul(3.8)
    const moonCell = moonSpace.floor()
    const moonRandom = cellNoiseVec3(moonCell)
    const moonLocal = moonSpace.fract().sub(moonRandom.mul(0.5).add(0.25))
    const moonRadius = moonRandom.z.mul(0.14).add(0.17)
    const moonDistance = moonLocal.length().sub(moonRadius)
    const moonFootprint = moonDistance.fwidth().max(0.002)
    const moonRing = moonDistance.abs().smoothstep(0.018, moonFootprint.mul(1.1).add(0.018)).oneMinus()
    const occludingDisc = moonLocal.sub(vec3(0.075, -0.018, 0).add(view.mul(intimate.mul(0.035)))).length().smoothstep(moonRadius.mul(0.93), moonRadius.mul(1.08)).oneMinus()
    const crescent = moonRing.mul(occludingDisc.oneMinus()).mul(moonRandom.x.smoothstep(0.36, 0.45))
    const dust = starfield(p, 17, 0.91).mul(intimate).mul(grazing.mul(0.45).add(0.55))
    const velvetLift = grazing.pow(1.45).mul(nap.mul(0.45).add(0.55)).mul(napDirection.mul(0.52).add(0.48))
    const base = mix(color(hsl.integer(282, 48, 2.5)), color(hsl.integer(315, 64, 7)), grain.mul(0.28).add(velvetLift.mul(0.65)))
    const crescentTint = mix(color(hsl.integer(34, 100, 62.5)), color(hsl.integer(77, 100, 86.6)), moonRandom.y)
    const livingCrescent = crescent.mul(time.mul(0.42).add(moonRandom.z.mul(6.28318)).sin().mul(0.14).add(0.86))
    const fiberHeight = nap.sub(0.5).mul(grazing.mul(0.7).add(0.3)).add(grain.sub(0.5).mul(0.12))
    this.colorNode = mix(base, color(hsl.integer(337, 73, 25)), velvetLift.mul(0.36))
    this.metalness = 0
    this.roughnessNode = float(0.91).sub(velvetLift.mul(0.22)).sub(crescent.mul(0.1)).clamp(0.55, 0.95)
    this.sheen = 1
    this.sheenColor.set(hsl.integer(344, 72, 49))
    this.sheenRoughness = 0.74
    this.clearcoatNode = crescent.mul(0.22)
    this.clearcoatRoughness = 0.32
    this.normalNode = proceduralNormal(fiberHeight, 0.00048)
    this.emissiveNode = crescentTint.mul(livingCrescent).mul(near.mul(0.6).add(0.22)).mul(0.78)
      .add(dust.mul(0.8))
      .add(color(hsl.integer(312, 76, 17)).mul(grazing.pow(3)).mul(0.16))
  }
}
