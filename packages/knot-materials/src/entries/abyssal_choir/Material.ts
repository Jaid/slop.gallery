import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A deep-sea creature wearing the knot as its skin. Rows of photophores kindle in a slow traveling procession around the body, each lens swelling under a wet clearcoat; a second, finer constellation wakes only at intimate range, while teal light bleeds around the silhouette like gills breathing. The whole skin rises and falls in a two-second breath. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const mottle = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const skin = mix(color(hsl.integer(221, 84, 13)), color(hsl.integer(220, 84, 25)), mottle).add(color(hsl.integer(214, 87, 28)).mul(mx_noise_float(p.mul(17)).mul(0.5).add(0.5)).mul(0.35))
    const lenses = beads(p.mul(15), 2.9)
    const sparks = beads(p.mul(36), 8.4)
    const procession = tube.x.mul(TAU * 3).sub(time.mul(Math.PI * 2))
    const pulse = procession.add(lenses.random.z.mul(TAU)).sin().mul(0.5).add(0.5).pow(2)
    const glowPulse = pulse.mul(0.75).add(0.3)
    const lensColor = mix(color(hsl.integer(208.2, 100, 83.1)), color(hsl.integer(286, 99, 53)), lenses.random.x)
    const sparkPulse = procession.mul(1.7).add(sparks.random.z.mul(TAU)).sin().mul(0.5).add(0.5).pow(2)
    const facingWeight = mix(float(0.3), float(1), facing)
    const choir = lensColor.mul(lenses.mask).mul(glowPulse).mul(facingWeight)
    const constellation = mix(color(hsl.integer(200, 100, 88.6)), color(hsl.integer(297, 100, 68)), sparks.random.x).mul(sparks.mask).mul(sparkPulse).mul(intimate)
    const breath = time.mul(Math.PI).sin().mul(0.5).add(0.5)
    const gills = color(hsl.integer(210, 94, 47)).mul(grazing.pow(2)).mul(breath.mul(0.3).add(0.34))
    this.positionNode = positionGeometry.add(normalLocal.mul(time.mul(Math.PI).add(tube.x.mul(TAU * 2)).sin().mul(0.0035)))
    this.colorNode = skin
    this.metalness = 0.05
    this.roughnessNode = mix(mix(float(0.34), float(0.58), mottle), float(0.12), lenses.mask)
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(lenses.cap.mul(lenses.mask).add(mx_noise_float(p.mul(30)).mul(intimate).mul(0.2)), 0.0012)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = choir.mul(3.4).add(constellation.mul(2)).add(gills).add(skin.mul(0.1)).mul(near.mul(0.25).add(0.85))
  }
}
