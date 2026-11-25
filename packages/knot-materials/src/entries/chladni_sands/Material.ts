import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, negateOnBackSide, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/gpt_astra/lib/bumpNormal.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import {wrapCell} from '../../candidates/gpt_astra/lib/wrapCell.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function chladniField(tube: Node<'vec2'>) {
  const U = tube.x.mul(TAU)
  const V = tube.y.mul(TAU)
  const balance = time.mul(0.09).sin().mul(0.12).add(0.8)
  return U.mul(18).sin().mul(V.mul(2).sin())
    .sub(U.mul(12).cos().mul(V.mul(3).sin()).mul(balance))
    .add(U.mul(6).sin().mul(V.cos()).mul(0.2))
}

/** Pale mineral sand resting on a blue resonating membrane. Slowly changing standing waves reorganize the powder. Oblique views reveal piled dunes; close views resolve individual grains. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {N, T, B, near, uvSlope} = viewerFrame()
    const originalField = chladniField(tube)
    const originalPile = originalField.pow(2).mul(-70).exp()
    const raisedTube = tube.add(uvSlope.mul(originalPile.mul(0.0035)))
    const field = chladniField(raisedTube)
    const pile = field.pow(2).mul(-60).exp()
    const sandMask = field.abs().smoothstep(0.07, field.fwidth().mul(0.65).add(0.12)).oneMinus()
    const grainPeriod = vec2(2300, 260)
    const grainQ = raisedTube.mul(grainPeriod)
    const random = cellNoiseVec3(vec3(wrapCell(grainQ.floor(), grainPeriod), 23.4))
    const grainFootprint = grainQ.fwidth().length()
    const grainVisibility = visibility(grainFootprint, 0.25, 1.15).mul(near)
    const grainDistance = grainQ.fract()
      .sub(random.xy.mul(0.3).add(0.35))
      .length()
    const grainShape = grainDistance.smoothstep(0.31, grainFootprint.mul(0.3).add(0.43)).oneMinus()
    // Unresolved powder converges to an average coverage instead
    // of disappearing or turning into subpixel glitter.
    const coverage = sandMask.mul(mix(float(0.73), grainShape.mul(0.6).add(0.4), grainVisibility))
    const sandTint = mix(color(hsl.integer(83, 53, 76)), color(hsl.integer(89, 100, 95)), random.z.mul(0.55).add(0.35))
    const membraneWave = tube.x.mul(TAU * 8).sin()
      .mul(tube.y.mul(TAU * 2).sin())
      .mul(0.00005)
    const pileNormal = bumpNormal(pile.mul(0.0033).add(membraneWave), N)
    const facetStrength = grainVisibility.mul(coverage).mul(0.5)
    const grainNormal = pileNormal
      .add(T.mul(random.x.sub(0.5)).mul(facetStrength))
      .add(B.mul(random.y.sub(0.5)).mul(facetStrength))
      .normalize()
    const quartz = random.z.smoothstep(0.96, 0.99)
      .mul(grainVisibility)
      .mul(coverage)
    this.colorNode = mix(color(hsl.integer(250, 79, 18)), sandTint, coverage)
    this.metalnessNode = coverage.oneMinus().mul(0.78)
    this.roughnessNode = mix(float(0.26), float(0.82), coverage).sub(quartz.mul(0.6))
    this.ior = 1.55
    this.clearcoat = 0.28
    this.clearcoatNode = coverage.oneMinus().mul(0.28)
    this.clearcoatRoughness = 0.12
    this.clearcoatNormalNode = normalViewGeometry
    this.normalNode = negateOnBackSide(grainNormal)
    this.aoNode = sandMask.mul(-0.15).add(1)
  }
}
