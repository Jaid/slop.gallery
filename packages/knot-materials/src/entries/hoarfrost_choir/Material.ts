import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec2} from 'three/tsl'

import {breath, facetGlints, tangentViewFrame} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, polarAngle, resolved, segmentDistance, stroke, tiles, torusNoise} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Fold the plane into one mirrored sixty-degree sector, then grow nested barbs on every spoke. */
function dendrite(point: Node<'vec2'>, footprint: Node<'float'>) {
  const radius = point.length()
  const angle = polarAngle(point).add(TAU + Math.PI / 6)
    .mod(Math.PI / 3).sub(Math.PI / 6).abs()
  const p = vec2(radius.mul(angle.cos()), radius.mul(angle.sin()))
  let distance = segmentDistance(p, vec2(0, 0), vec2(0.4, 0))
  for (let index = 0;index < 3;index++) {
    const x = 0.1 + index * 0.085
    const size = 0.105 - index * 0.022
    distance = distance.min(segmentDistance(p, vec2(x, 0), vec2(x + size * 0.6, size)))
      .min(segmentDistance(p, vec2(x + size * 0.3, size * 0.5), vec2(x + size * 0.06, size * 0.85)))
  }
  const width = radius.mul(-0.016).add(0.012).max(0.004)
  const branches = stroke(distance, width, footprint)
  const hexagon = fill(p.x.sub(0.045), footprint)
  return {
    mask: branches.max(hexagon),
    radius,
    angle,
  }
}

/** Frosted smoky ice: sixfold dendrites, buried fractures, powder and camera-dependent crystal flashes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = data.id
    const tube = uv()
    const {p, grazing, intimate, near} = viewerFrame()
    const {T, B, N} = tangentViewFrame()
    const cell = tiles(tube, 26, 5, 8.4)
    const flake = dendrite(cell.point.mul(vec2(1.45, 1)), cell.footprint.mul(1.45))
    const frostClimate = torusNoise(tube, 5, 1.8, 29).mul(0.5).add(0.5)
    const climate = frostClimate.add(breath.sin().mul(0.012)).smoothstep(0.24, 0.76).toVar()
    const branches = flake.mask.mul(cell.random.z.mul(0.35).add(0.65)).mul(climate.mul(0.65).add(0.35)).toVar()
    const powderCoordinates = p.mul(100)
    const powder = mx_noise_float(powderCoordinates).mul(0.5).add(0.5)
      .smoothstep(0.3, 0.7).mul(resolved(powderCoordinates))
    const frost = branches.mul(0.8).add(climate.mul(0.42)).add(powder.mul(climate).mul(0.26)).clamp().toVar()
    const buried = tiles(tube.sub(tubeRay().mul(0.012)), 19, 4, 27.1)
    const fracture = dendrite(buried.point.mul(vec2(1.7, 1)), buried.footprint.mul(1.7)).mask
      .mul(branches.oneMinus()).mul(0.18)
    const deepIce = mix(color(hsl.integer(241, 59, 21)), color(hsl.integer(233, 38, 44)), frostClimate)
      .add(color(hsl.integer(221, 30, 81)).mul(fracture))
    const chalk = mix(color(hsl.integer(230, 34, 73)), color(hsl.integer(154, 17, 91)), branches.mul(0.65).add(powder.mul(0.35)).clamp())
    this.colorNode = mix(deepIce, chalk, frost)
    this.metalnessNode = frost.mul(-0.11).add(0.14)
    this.roughnessNode = mix(float(0.12), float(0.65), frost).sub(branches.mul(0.12)).clamp(0.1, 0.7)
    const relief = branches.mul(0.0008).add(powder.mul(climate).mul(0.00013))
      .add(mx_noise_float(p.mul(17)).mul(0.0001))
    this.normalNode = engravedNormal(normalViewGeometry, relief, 0.7)
    this.clearcoat = 0.7
    this.clearcoatNode = frost.mul(-0.52).add(0.7)
    this.clearcoatRoughnessNode = frost.mul(0.14).add(0.055)
    this.clearcoatNormalNode = normalViewGeometry
    this.ior = 1.31
    this.sheen = 0.3
    this.sheenNode = color(hsl.integer(228, 32, 80)).mul(frost).mul(0.3)
    this.sheenRoughness = 0.65
    this.iridescenceNode = branches.mul(grazing.pow(2)).mul(0.22)
    this.iridescenceThicknessNode = cell.random.y.mul(110).add(180)
    const facet = N.add(T.mul(cell.random.x.sub(0.5)).mul(0.5)).add(B.mul(cell.random.y.sub(0.5)).mul(0.5)).normalize()
    const sparkle = facetGlints(facet, 210).mul(branches).mul(resolved(cell.q)).toVar()
    const polarized = mix(color(hsl.integer(251, 100, 86.3)), color(hsl.integer(67, 100, 90.4)), T.dot(tangentViewFrame().V).mul(0.5).add(0.5))
    this.emissiveNode = polarized.mul(sparkle).mul(0.75)
      .add(color(hsl.integer(228, 49, 65)).mul(fracture).mul(near).mul(0.09))
      .add(color(hsl.integer(194, 38, 91.6)).mul(branches).mul(intimate).mul(0.012))
    this.aoNode = frost.mul(-0.08).add(1)
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'polarized dendritic frost',
    }
  }
}
