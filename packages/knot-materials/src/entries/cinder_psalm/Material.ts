import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {tubeGrid} from '../../candidates/claude_sonnet/lib/tubeGrid.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiBorder.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Blackbody-like ramp in linear light: ember red → orange → straw → white. */
const blackbody = (t: Node<'float'>) => {
  const heat = t.clamp()
  const red = heat.smoothstep(0, 0.35)
  const orange = heat.smoothstep(0.25, 0.65)
  const yellow = heat.smoothstep(0.55, 0.9)
  const white = heat.smoothstep(0.85, 1)
  return vec3(0.55, 0.03, 0.005).mul(red)
    .add(vec3(0.9, 0.28, 0.01).mul(orange))
    .add(vec3(0.6, 0.5, 0.06).mul(yellow))
    .add(vec3(0.5, 0.6, 0.7).mul(white))
}
/** Fresh basalt that has cooled into shifting plates. Cracks hold molten rock that breathes in slow waves; the plates glow ember-red toward their borders, and as you lean in a second generation of hairline fractures opens, hot sparks lift off the crust and the whole surface brightens toward yellow. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {near, intimate, grazing, facing} = viewerFrame()
    const p = positionGeometry
    const large = tubeGrid(6)
    const small = tubeGrid(22)
    const warp = (scale: number, seed: number) => vec2(mx_noise_float(p.mul(scale).add(seed)), mx_noise_float(p.mul(scale).add(seed + 13.1))).mul(0.5)
    const plate = tubeVoronoi(large.period, 1.9, 0.9)(large.grid.add(warp(3.1, 0.7).mul(1.1)))
    const hair = tubeVoronoi(small.period, 7.7, 0.95)(small.grid.add(warp(6, 2.3)))
    const grit = mx_fractal_noise_float(p.mul(28), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const blob = mx_fractal_noise_float(p.mul(3.6).add(vec3(0, 0, time.mul(0.05))), 3, 2, 0.5).mul(0.5).add(0.5)
  // Crack coverage with a filtered edge so distant seams fade into warm haze.
    const crackWidth = blob.mul(0.06).add(0.035)
    const footprint = plate.edge.fwidth().max(1e-5)
    const crack = crackWidth.sub(plate.edge).div(footprint).add(0.5).clamp()
    const hairWidth = float(0.05)
    const hairFoot = hair.edge.fwidth().max(1e-5)
    const hairCrack = hairWidth.sub(hair.edge).div(hairFoot).add(0.5).clamp().mul(near.smoothstep(0.15, 0.6)).mul(hair.id.z.smoothstep(0.45, 0.6)).mul(crack.oneMinus())
  // Heat waves travel through the melt, so the fire never sits still.
    const wave = p.dot(vec3(2.4, 1.7, -2.1)).add(blob.mul(4)).sub(time.mul(0.45)).sin().mul(0.5).add(0.5)
    const flare = mx_noise_float(p.mul(9).add(vec3(0, time.mul(0.35), 0))).mul(0.5).add(0.5)
    const melt = wave.mul(0.3).add(flare.mul(0.35)).add(0.25).add(near.mul(0.1))
    const halo = plate.edge.smoothstep(0, 0.42).oneMinus().pow(2.2).mul(0.32).mul(plate.id.y.mul(0.6).add(0.4))
    const hairHalo = hair.edge.smoothstep(0, 0.2).oneMinus().pow(2).mul(0.16).mul(near.smoothstep(0.15, 0.6))
    const heat = crack.mul(melt).add(hairCrack.mul(melt.mul(0.85))).add(halo.mul(melt.mul(0.5).add(0.3))).add(hairHalo)
    const crust = mix(color(hsl.integer(0, 0, 3.7)), color(hsl.integer(53, 13, 10)), grit.mul(0.8).add(plate.id.x.mul(0.2)))
    const frost = color(hsl.integer(264, 7, 19)).mul(grit.smoothstep(0.62, 0.85).mul(0.5))
    this.colorNode = crust.add(frost).mul(crack.add(hairCrack).oneMinus().clamp())
    this.metalness = 0.05
    this.roughnessNode = float(0.72).sub(grit.mul(0.15)).sub(crack.mul(0.3)).add(grazing.mul(0.1))
    this.clearcoatNode = crack.add(hairCrack).mul(0.8)
    this.clearcoatRoughness = 0.05
    this.sheen = 0.4
    this.sheenColor.set(hsl.integer(36, 89, 22))
    this.sheenRoughness = 0.7
    const plateHeight = plate.edge.smoothstep(0, 0.32).mul(0.006).add(plate.id.z.mul(0.0015))
    const height = plateHeight.add(grit.mul(0.0011)).sub(crack.mul(0.0035)).sub(hairCrack.mul(0.0012))
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), height)
  // Vertex stage cannot use screen derivatives, so the sunken seam is derived from the raw distance instead.
    const seamDepth = plate.edge.smoothstep(crackWidth.sub(0.02), crackWidth.add(0.04)).oneMinus().mul(0.0018)
    this.positionNode = p.add(normalLocal.mul(plateHeight.mul(0.5).sub(seamDepth)))
  // Sparks: sparse hot points that lift off the crust as you come close.
    const rise = vec3(0, time.mul(-0.32), 0)
    const sparks = cellularPoints(p.mul(70).add(rise), 0.02, 0.12, 0.9).mul(intimate)
    const spark = sparks.mul(time.mul(3).add(p.x.mul(90)).sin().mul(0.3).add(0.7))
    this.emissiveNode = blackbody(heat.mul(near.mul(0.2).add(0.6))).mul(0.55)
      .add(color(hsl.integer(43, 100, 65.4)).mul(spark).mul(2.4))
      .add(color(hsl.integer(33.1, 100, 59.5)).mul(crack.mul(grazing.pow(2))).mul(0.4))
      .add(blackbody(float(0.45)).mul(hairCrack).mul(facing).mul(0.2))
  }
}
