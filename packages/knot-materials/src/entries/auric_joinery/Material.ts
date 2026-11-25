import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, uv} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Kintsugi. Dark urushi lacquer over stoneware, crazed into a fracture network and repaired in gold. The gold is not paint: it is metal sitting in a crevice, so it turns bright and cold when you look along the surface and goes almost black when you face it head on. Lean in and the repair keeps branching, down to dust. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, grazing, rim, near, intimate} = viewerFrame()
// --- the fracture network, warped so no two veins agree ---
    const warp = mx_noise_vec3(p.mul(3.4)).mul(0.06)
    const coarse = p.mul(15).add(warp.mul(15))
    const crack = cellularBoundary(coarse)
    const width = mx_noise_float(coarse.mul(0.55)).mul(0.022).add(0.03)
    const primary = filteredRibbon(crack, width)
    const warp2 = mx_noise_vec3(p.mul(7.1)).mul(0.028)
    const medium = p.mul(28).add(warp2.mul(28))
    const branch = filteredRibbon(cellularBoundary(medium), mx_noise_float(medium.mul(0.5)).mul(0.016).add(0.022))
      .mul(near.mul(0.75).add(0.08))
    const micro = filteredRibbon(cellularBoundary(p.mul(92).add(warp2.mul(92))), 0.02).mul(intimate)
    const repair = primary.add(branch.mul(0.72)).add(micro.mul(0.45)).clamp()
// Some veins were burnished to a mirror, others left as powdered gold.
    const burnish = mx_noise_float(coarse.mul(0.4)).mul(0.5).add(0.5)
// The mask is pushed toward binary: a soft field would tint the whole
// lacquer with gold and the body would stop being black.
    const gild = repair.mul(burnish.mul(0.45).add(0.75)).clamp().smoothstep(0.22, 0.62)
// The lacquer around a repair was polished back flat, so a wide,
// barely visible sheen surrounds every seam.
    const halo = filteredRibbon(crack, width.mul(2.2))
// --- the ceramic underneath ---
    const speck = mx_fractal_noise_float(p.mul(58), 2, 2, 0.5).mul(0.5).add(0.5)
    const patina = mx_fractal_noise_float(p.mul(4.5), 3, 2, 0.5).mul(0.5).add(0.5)
    const brush = opticalBands(uv().x.mul(TAU * 420))
    const lacquer = mix(color(hsl.integer(274, 34, 6)), color(hsl.integer(267, 37, 15)), speck.mul(0.45).add(0.08))
    const clay = mix(color(hsl.integer(67, 18, 16)), color(hsl.integer(69, 37, 24)), patina)
    const body = mix(lacquer, clay, patina.pow(2.5).mul(0.35)).mul(brush.mul(0.05).add(0.975))
    const goldTone = mix(color(hsl.integer(75, 92, 63)), color(hsl.integer(96, 100, 96.7)), burnish.mul(0.8).add(0.12))
    this.colorNode = mix(body, goldTone, gild)
// The repair sits proud of the lacquer by a hair. The veins are far
// too narrow for the vertex grid to carry them, so the ridge lives
// entirely in the shading normal – which is where it is read anyway.
    const hammer = mx_noise_float(p.mul(150)).mul(intimate)
    const relief: Node<'float'> = gild.mul(0.0021).add(hammer.mul(gild).mul(0.00018))
    const reliefNormal = proceduralNormal(relief.mul(0.75).add(hammer.mul(gild).mul(0.00035)), 1)
    this.normalNode = reliefNormal
    this.clearcoatNormalNode = reliefNormal
    this.metalnessNode = gild.mul(0.96)
    this.roughnessNode = mix(float(0.56).sub(patina.mul(0.1)).sub(halo.mul(0.14)), mix(float(0.05), float(0.3), burnish), gild)
    this.clearcoatNode = halo.mul(0.16).add(0.07)
    this.clearcoatRoughnessNode = float(0.3).sub(gild.mul(0.18))
    this.specularIntensityNode = float(0.34)
    this.ior = 1.5
// Gold dust scattered around the seams, plus a faint warmth deep in
// the widest cracks once the viewer is close enough to see into them.
    const dustNormal = normalViewGeometry.add(mx_noise_vec3(p.mul(320)).mul(0.7)).normalize()
    const dust = glints(dustNormal, 150).mul(gild).mul(near)
    const ember = mx_noise_float(p.mul(9)).mul(0.5).add(0.5).mul(intimate).mul(gild.pow(2))
    const glow: Node<'vec3'> = color(hsl.integer(90, 100, 95))
      .mul(dust)
      .mul(1.6)
      .add(color(hsl.integer(56, 100, 71.8)).mul(ember).mul(0.04))
      .add(color(hsl.integer(80, 58, 75)).mul(grazing.pow(3)).mul(gild).mul(0.2))
      .add(color(hsl.integer(85, 100, 88.5)).mul(gild).mul(0.05))
      .add(color(hsl.integer(83, 100, 86.6)).mul(rim).mul(0.015))
    this.emissiveNode = glow
  }
}
