import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec2, vec3} from 'three/tsl'

import {breath} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, resolved, segmentDistance, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** A fossil seed with feathered pinnae, not a particle or a repeated glowing dot. */
function seed(point: Node<'vec2'>, random: Node<'vec3'>, footprint: Node<'float'>) {
  const theta = random.y.mul(TAU)
  const p = vec2(point.x.mul(theta.cos()).sub(point.y.mul(theta.sin())), point.x.mul(theta.sin()).add(point.y.mul(theta.cos())))
  let distance = segmentDistance(p, vec2(0, -0.29), vec2(0, 0.29))
  for (let index = 0;index < 5;index++) {
    const y = -0.22 + index * 0.095
    const spread = Math.sin((index + 1) / 6 * Math.PI) * 0.18
    for (const sign of [-1, 1]) {
      distance = distance.min(segmentDistance(p, vec2(0, y), vec2(sign * spread, y + 0.105)))
    }
  }
  const skeleton = stroke(distance, 0.004, footprint)
  const body = fill(p.mul(vec2(2.8, 1)).length().sub(0.16), footprint).mul(0.45)
  const resolvedSeed = footprint.smoothstep(0.05, 0.3).oneMinus()
  return skeleton.add(body).mul(random.x.smoothstep(0.69, 0.8)).mul(resolvedSeed)
}

/** Four absorbing depths of seed inclusions, tiny bubbles and warm caustics beneath a resin skin. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = data.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const ray = tubeRay().mul(0.64).toVar()
    const amberCloud = mx_noise_float(p.mul(3).add(vec3(view.mul(0.12)))).mul(0.5).add(0.5).toVar()
    const heart = mix(color(hsl.integer(40, 90, 22)), color(hsl.integer(51, 96, 59)), amberCloud)
    let interior: Node<'vec3'> = heart
    let inclusion: Node<'float'> = float(0)
    for (const [index, depth] of [0.061, 0.04, 0.023, 0.009].entries()) {
      const sample = tube.sub(ray.mul(depth))
      const layer = tiles(sample, 12, 4, 13.2 + index * 7.3)
      const fern = seed(layer.point.mul(1.03), layer.random, layer.footprint).toVar()
      const absorb = Math.exp(-depth * 13)
      const fossil = mix(color(hsl.integer(45, 81, 18)), color(hsl.integer(85, 100, 90.4)), layer.random.z.mul(0.7))
        .mul(absorb).mul(near.mul(0.2).add(0.8))
      interior = mix(interior, fossil, fern.mul(0.8)).toVar()
      inclusion = inclusion.max(fern)
      const bead = tiles(sample.add(0.031), 40, 11, 29.3 + index * 3.7)
      const center = bead.random.xy.sub(0.5).mul(0.23)
      const point = bead.point.sub(center)
      const radius = bead.random.z.mul(0.05).add(0.045)
      const ring = stroke(point.length().sub(radius), 0.005, bead.footprint)
        .mul(bead.random.y.smoothstep(0.55, 0.65)).mul(resolved(bead.q))
      const bubbleBody = fill(point.length().sub(radius), bead.footprint).mul(bead.random.y.smoothstep(0.55, 0.65))
      const crescent = point.dot(vec2(-0.5, 0.85)).div(radius).smoothstep(0.25, 0.8)
      interior = interior.mul(bubbleBody.mul(-0.09).add(1))
        .add(color(hsl.integer(89, 100, 88)).mul(ring).mul(crescent.mul(0.65).add(0.1)).mul(absorb * 0.9)).toVar()
    }
    const pressure = mx_noise_float(p.mul(8).add(view.mul(0.16))).mul(1.3)
    const causticPhase = p.dot(vec3(12, 19, -8)).add(pressure).add(breath.sin().mul(0.13))
    const caustic = wave(causticPhase).mul(wave(causticPhase.mul(1.7).add(p.z.mul(5))))
      .smoothstep(0.32, 0.9).mul(inclusion.oneMinus()).toVar()
    const absorption = float(1).sub(grazing.mul(0.66)).mul(0.8).add(0.16)
    const resin = interior.mul(absorption).add(color(hsl.integer(67, 93, 71)).mul(caustic).mul(0.24)).toVar()
    this.colorNode = resin.mul(0.65).add(color(hsl.integer(40, 93, 10)).mul(grazing.pow(4)))
    this.emissiveNode = resin.mul(0.58).mul(facing.mul(0.25).add(0.75))
      .add(color(hsl.integer(80, 100, 84.3)).mul(caustic).mul(intimate).mul(0.12))
    this.metalness = 0
    this.roughnessNode = float(0.17).add(amberCloud.mul(0.055)).sub(intimate.mul(0.018))
    this.ior = 1.54
    this.specularIntensity = 0.8
    this.clearcoat = 1
    this.clearcoatRoughness = 0.075
    const polish = mx_noise_float(p.mul(24)).mul(0.00015)
    const scuffPhase = tube.x.mul(TAU * 620).add(tube.y.mul(TAU * 3).sin().mul(2))
    const scuff = wave(scuffPhase).mul(intimate).mul(0.000006)
    this.normalNode = engravedNormal(normalViewGeometry, polish.add(scuff))
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = inclusion.mul(-0.12).add(1)
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'absorbing multilayer inclusion parallax',
    }
  }
}
