import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {tubeGrid} from '../../candidates/claude_sonnet/lib/tubeGrid.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiBorder.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Area coverage of a band around a distance field: exact box filter, so distant seams fade into a gold haze instead of shimmering. */
const band = (distance: Node<'float'>, halfWidth: Node<'float'> | number) => {
  const footprint = distance.fwidth().max(1e-5)
  const width = typeof halfWidth === 'number' ? float(halfWidth) : halfWidth
  return width.sub(distance).div(footprint).add(0.5).clamp()
}
/** A tenmoku bowl shattered and mended with gold lacquer. Silver oil-spots float in the black glaze, the seams meander with hand-drawn irregularity, and slow pulses of warm light travel along the gold like a heartbeat through the repair. Lean in and a second, finer generation of hairline mends appears. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {intimate, near, grazing, facing} = viewerFrame()
    const p = positionGeometry
    const major = tubeGrid(5)
    const minor = tubeGrid(17)
    const spots = tubeGrid(46)
  // Hand-drawn irregularity: warp the lattices with low-frequency noise.
    const wobble = (scale: number, seed: number) => vec2(mx_noise_float(p.mul(scale).add(seed)), mx_noise_float(p.mul(scale).add(seed + 19.7))).mul(0.5)
    const cracks = tubeVoronoi(major.period, 5.2, 0.95)(major.grid.add(wobble(3.4, 0.3).mul(1.3)))
    const hairs = tubeVoronoi(minor.period, 11.1, 0.95)(minor.grid.add(wobble(7, 4.1)))
    const flecks = tubeVoronoi(spots.period, 2.4, 0.8)(spots.grid)
    const seamNoise = mx_fractal_noise_float(p.mul(9), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const majorWidth = seamNoise.smoothstep(0.15, 0.85).mul(0.085).add(0.028)
    const minorWidth = seamNoise.mul(0.02).add(0.011)
    const goldMajor = band(cracks.edge, majorWidth)
  // The finer mends appear on approach and stop short of the largest gaps.
    const goldMinor = band(hairs.edge, minorWidth).mul(near.mul(0.85).add(0.15)).mul(goldMajor.oneMinus()).mul(hairs.id.z.smoothstep(0.35, 0.5))
    const gold = goldMajor.add(goldMinor).clamp()
  // Oil spots: silver-blue discs that crowd around the mends and thin out toward the plate centers.
    const spotRadius = flecks.id.x.mul(0.16).add(0.12)
    const spotDensity = flecks.id.y.smoothstep(0.35, 0.55)
    const spot = flecks.distance.div(spotRadius).smoothstep(0.75, 1).oneMinus().mul(spotDensity).mul(gold.oneMinus())
    const spotRing = flecks.distance.div(spotRadius).smoothstep(0.55, 0.85).mul(spot)
  // Pulses of warm light travel along the gold: phase follows a noise field measured on the surface.
    const pathA = mx_noise_float(p.mul(2.3)).mul(3.2).add(p.x.mul(1.6)).sub(time.mul(0.22))
    const pulse = pathA.sin().mul(0.5).add(0.5).pow(6)
    const slowBreath = time.mul(0.6).sin().mul(0.18).add(0.82)
    const heat = pulse.mul(0.85).add(0.15).mul(slowBreath)
    const glaze = mix(color(hsl.integer(284, 27, 2)), color(hsl.integer(290, 26, 6)), seamNoise.mul(0.6).add(grazing.pow(2).mul(0.5)))
    const spotColor = mix(color(hsl.integer(252, 39, 43)), color(hsl.integer(254, 30, 85)), spotRing)
    const leaf = mix(color(hsl.integer(73, 84, 53)), color(hsl.integer(88, 100, 88)), facing.pow(0.5).mul(0.5).add(seamNoise.mul(0.5)))
    this.colorNode = mix(mix(glaze, spotColor, spot.mul(0.85)), leaf, gold)
    this.metalnessNode = gold.mul(0.98).add(spot.mul(0.55))
    this.roughnessNode = mix(mix(float(0.06), float(0.3), spot), float(0.24), gold).sub(intimate.mul(gold).mul(0.05))
    this.clearcoatNode = gold.oneMinus().mul(0.95)
    this.clearcoatRoughness = 0.02
    this.ior = 1.5
    this.iridescenceNode = spot.mul(0.9)
    this.iridescenceThicknessNode = spotRing.mul(240).add(280)
    this.anisotropy = 0.35
  // Gold lacquer stands proud of the glaze and carries hammered micro-facets.
    const hammered = mx_noise_float(p.mul(85)).mul(near).mul(0.00035)
    const height = gold.mul(0.0022).add(hammered.mul(gold)).add(spot.mul(0.0003))
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), height)
  // Gold flakes catch the studio lamps individually.
    const flake = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
    const flakeNormal = normalViewGeometry.add(vec3(flake.sub(0.5), flake.mul(7.3).fract().sub(0.5), flake.mul(3.1).fract().sub(0.5)).mul(0.6)).normalize()
    const sparkle = glints(flakeNormal, 90).mul(gold).mul(near.mul(0.6).add(0.15))
    this.emissiveNode = color(hsl.integer(62, 100, 73.8)).mul(gold).mul(heat).mul(intimate.mul(0.5).add(0.35)).mul(0.8)
      .add(color(hsl.integer(89, 100, 92)).mul(sparkle).mul(0.3))
      .add(color(hsl.integer(79, 100, 83)).mul(gold.mul(grazing.pow(2))).mul(0.06))
  }
}
