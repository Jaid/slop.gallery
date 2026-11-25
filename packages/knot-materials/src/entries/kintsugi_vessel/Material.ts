import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalView, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Coverage of a band of half-width `width` around the zero set of `distance`; the width itself may vary across the surface. */
const seam = (distance: Node<'float'>, width: Node<'float'>) => {
  const aa = distance.fwidth().max(0.0001)
  return distance.abs().smoothstep(width, width.add(aa.mul(1.25))).oneMinus()
}
/** Object-space domain warp, so the crack lattice reads as crazed glaze rather than a regular Voronoi grid. */
const drift = (p: Node<'vec3'>, scale: number) => vec3(mx_noise_float(p.mul(scale)), mx_noise_float(p.mul(scale).add(17.3)), mx_noise_float(p.mul(scale).sub(9.1))).mul(0.3)

/** Celadon porcelain crazed by time, mended with urushi lacquer and powdered gold. The crack lattice is a 3D Voronoi boundary, so each seam is a true curve through the glaze that follows the knot's volume. Gold rides above the glaze, the lacquer is mirror-glossy, and maki-e flecks catch the light as you turn. A slow pulse of candlelight travels along the seams. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const warp = drift(p, 2.1)
// Half-distance to each crack in lattice units: coarse cracks for the whole vessel, fine craquelure revealed up close.
    const crackCoarse = cellularBoundary(p.mul(4.1).add(warp)).mul(0.5)
    const crackFine = cellularBoundary(p.mul(13.5).add(warp.mul(1.6))).mul(0.5)
// Lacquer thickness varies, so the gold swells and thins along each seam.
    const thickness = mx_noise_float(p.mul(9.5)).mul(0.5).add(0.5)
    const gold = seam(crackCoarse, thickness.mul(0.022).add(0.014))
    const hairline = seam(crackFine, float(0.012)).mul(intimate.mul(0.75).add(0.25))
    const glazeTone = mix(color(hsl.integer(170, 35, 54)), color(hsl.integer(160, 25, 86)), mx_fractal_noise_float(p.mul(3.2), 4, 2, 0.5).mul(0.5).add(0.5))
    const crevice = seam(crackCoarse, float(0.16)).mul(0.5).add(hairline.mul(0.35)).clamp()
    const glaze = mix(glazeTone, color(hsl.integer(183, 36, 29)), crevice.mul(0.8))
    const goldTone = mix(color(hsl.integer(74, 83, 53)), color(hsl.integer(89, 76, 87)), mx_noise_float(p.mul(42)).mul(0.5).add(0.5))
// Maki-e flecks: sparse specks of gold powder that flash only at the angles where they face the room.
    const fleck = cellularPoints(p.mul(70), 0.03, 0.2, 0.74)
    const sparkle = glints(normalView, 70).mul(fleck)
    this.colorNode = mix(glaze, goldTone, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(mx_noise_float(p.mul(30)).mul(0.04).add(0.12), mx_noise_float(p.mul(20)).mul(0.05).add(0.27), gold)
    this.aoNode = float(1).sub(crevice.mul(gold.oneMinus()).mul(0.55)).clamp(0.2, 1)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    const relief = gold.mul(0.0019).sub(hairline.mul(0.0007)).add(mx_noise_float(p.mul(70)).mul(0.00018))
    const normal = proceduralNormal(relief, 1)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
// Candlelight travels along the seams on a two-second loop, so the knot's lacquer seems to glow from within.
    const pulse = time.mul(Math.PI).sub(p.dot(vec3(2.2, 1.3, -1.7)).mul(1.4)).cos().mul(0.5).add(0.5).pow(10)
    this.emissiveNode = goldTone.mul(gold).mul(pulse.mul(0.35).add(sparkle.mul(near.mul(0.9).add(0.1)).mul(1.4)))
      .add(color(hsl.integer(171, 56, 76)).mul(grazing.pow(3)).mul(0.1))
  }
}
