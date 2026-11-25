import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A glazed volcanic skin. Its broad plates cool to near black while nested microfractures retain enough heat to bloom from ember red into gold as the knot turns. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {grazing, intimate, near, p, rim} = viewerFrame()
    const slowDrift = vec3(time.mul(0.018), time.mul(-0.012), time.mul(0.009))
    const plateSpace = p.mul(3.55).add(slowDrift)
    const plateBoundary = cellularBoundary(plateSpace)
    const fissure = filteredRibbon(plateBoundary, 0.024)
    const fineBoundary = cellularBoundary(p.mul(10.5).sub(slowDrift.mul(2)))
    const fineFissure = filteredRibbon(fineBoundary, 0.011).mul(near)
    const crack = fissure.add(fineFissure.mul(0.52)).clamp()
    const plateIdentity = cellNoiseVec3(plateSpace.floor())
    const breathing = time.mul(0.68).add(plateIdentity.x.mul(6.28318)).sin().mul(0.22).add(0.78)
    const heat = crack.mul(breathing).mul(grazing.mul(0.24).add(0.88))
    const cinder = mx_fractal_noise_float(p.mul(7.5), 4, 2, 0.52).mul(0.5).add(0.5)
    const soot = mx_noise_float(p.mul(34)).mul(0.5).add(0.5)
    const ash = cellularPoints(p.mul(28), 0.035, 0.115, 0.89).mul(intimate)
    const basalt = mix(color(hsl.integer(17, 4, 5)), color(hsl.integer(36, 41, 18)), cinder.mul(0.5).add(soot.mul(0.12)))
    const scorched = mix(basalt, color(hsl.integer(32, 76, 27)), crack.mul(0.62))
    const ember = mix(color(hsl.integer(31.2, 100, 58.5)), color(hsl.integer(85, 100, 86)), plateIdentity.y.mul(0.58).add(breathing.mul(0.3)))
    const terrain = cinder.mul(0.72).add(soot.mul(0.12)).add(plateBoundary.oneMinus().mul(0.18))
    this.colorNode = mix(scorched, color(hsl.integer(59, 68, 66)), ash.mul(0.33))
    this.metalnessNode = float(0.18).add(cinder.mul(0.16)).sub(crack.mul(0.11)).clamp(0.03, 0.32)
    this.roughnessNode = float(0.24).add(cinder.mul(0.29)).sub(crack.mul(0.12)).clamp(0.08, 0.62)
    this.clearcoatNode = cinder.oneMinus().mul(0.62).add(crack.mul(0.16)).clamp()
    this.clearcoatRoughness = 0.14
    this.normalNode = proceduralNormal(terrain.add(crack.mul(0.36)), 0.00145)
    this.positionNode = p.add(normalLocal.mul(cinder.sub(0.5).mul(0.0032)))
    this.emissiveNode = ember.mul(heat).mul(1.45)
      .add(color(hsl.integer(57, 100, 75)).mul(fineFissure).mul(intimate).mul(0.36))
      .add(color(hsl.integer(29, 86, 30.5)).mul(rim).mul(0.09))
  }
}
