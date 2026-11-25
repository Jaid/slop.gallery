import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_vec3, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Deep glacier ice carved into a knot. A polished, frost-bitten skin seals three parallax strata of bright fracture planes and two depths of trapped air bubbles; looking straight in, you see down a blue well, while a grazing view turns the surface to white frost. Fractures flare only when they mirror a lamp to your eye. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    this.envMapIntensity = 1.1
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const crevasseField = mx_noise_float(p.mul(5.5).add(vec3(13.1, 7.7, 3.3)))
    const carved = mx_noise_float(p.mul(2.6)).mul(0.0045)
    const grooveVertex = crevasseField.abs().smoothstep(0.02, 0.1).oneMinus()
    this.positionNode = positionGeometry.add(normalLocal.mul(carved.sub(grooveVertex.mul(0.003))))
    const groove = opticalLine(crevasseField, 0.02)
    const frostNoise = mx_noise_float(p.mul(9)).mul(0.5).add(0.5).mul(0.7).add(mx_noise_float(p.mul(27)).mul(0.5).add(0.5).mul(0.3))
    const fineNoise = mx_noise_float(p.mul(28))
    const frostGrit = mx_noise_float(p.mul(55)).mul(0.5).add(0.5).smoothstep(0.3, 0.7).mul(0.6).add(0.4)
    const frost = frostNoise.smoothstep(0.66, 0.86).mul(frostGrit)
    this.normalNode = proceduralNormal(fineNoise.mul(0.45).add(frostNoise.mul(0.35)).sub(groove.mul(0.3)), 0.0024)
    // Three sealed strata of fracture planes, each deeper, bluer and dimmer.
    let fractureGlow: Node<'vec3'> = vec3(0)
    const strata: Array<[number, number, number]> = [[0.05, 7, 0], [0.12, 5, 17.3], [0.2, 3.4, 41.9]]
    for (const [depth, scale, seed] of strata) {
      const warped = p.sub(view.mul(depth)).add(mx_fractal_noise_vec3(p.mul(1.4).add(seed), 2, 2.1, 0.55).mul(0.14))
      const q = warped.mul(scale).add(seed)
      const crack = cellularBoundary(q).smoothstep(0.008, 0.028 + depth * 0.25).oneMinus()
      const alongCrack = mx_noise_float(q.mul(0.7)).mul(0.5).add(0.5).mul(0.65).add(0.35)
      const facet = normalViewGeometry.add(cellNoiseVec3(q.floor()).sub(0.5).mul(0.7)).normalize()
      const flare = glints(facet, 90).mul(2.2).add(0.04)
      const tint = mix(color(hsl.integer(0, 0, 100)), color(hsl.integer(228, 86, 70)), depth * 3.4)
      fractureGlow = fractureGlow.add(tint.mul(crack).mul(flare).mul(alongCrack).mul(1 - depth * 2.1))
    }
    // Air sealed mid-rise, in two planes so the bubbles stream past one another.
    const bubbles = cellularPoints(p.sub(view.mul(0.08)).mul(46), 0.02, 0.15, 0.42)
      .add(cellularPoints(p.sub(view.mul(0.16)).mul(30), 0.02, 0.13, 0.48).mul(0.7)).mul(1.3)
    const sparkleNormal = normalViewGeometry.add(cellNoiseVec3(p.mul(240).floor()).sub(0.5).mul(0.9)).normalize()
    const snowGlitter = glints(sparkleNormal, 260).mul(frost).mul(near.mul(0.7).add(0.3))
    const groan = time.mul(0.05).sin().mul(0.12).add(0.88)
    const deepWell = mix(color(hsl.integer(248, 89, 22)), color(hsl.integer(248, 83, 10)), facing.pow(1.5).oneMinus().mul(0.4))
    const body = mix(color(hsl.integer(243, 49, 57)), deepWell, facing.pow(1.3).mul(0.97).add(0.02))
    this.colorNode = mix(body, color(hsl.integer(220, 44, 96.5)), frost.mul(0.18)).mul(groove.mul(-0.06).add(1))
    this.metalness = 0
    this.specularIntensity = 1.2
    this.roughnessNode = mix(float(0.035), float(0.58), frost)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.03), float(0.4), frost)
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = groove.mul(-0.12).add(1)
    this.emissiveNode = fractureGlow.mul(facing.pow(3).mul(0.85).add(0.05)).mul(frost.mul(-0.6).add(1)).mul(near.mul(0.35).add(0.8)).mul(groan)
      .add(color(hsl.integer(232, 89, 64)).mul(groove).mul(facing.mul(0.7).add(0.25)).mul(0.1))
      .add(color(hsl.integer(0, 0, 100)).mul(bubbles).mul(facing.mul(0.6).add(0.4)).mul(intimate.mul(0.9).add(0.25)))
      .add(color(hsl.integer(234, 100, 96.4)).mul(snowGlitter).mul(0.9))
      .add(color(hsl.integer(0, 0, 100)).mul(glints(normalViewGeometry, 300)).mul(0.3))
      .add(color(hsl.integer(228, 66, 83)).mul(rim).mul(0.16))
      .add(color(hsl.integer(231, 88, 35)).mul(facing.pow(3)).mul(0.65))
  }
}
