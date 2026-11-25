import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, negateOnBackSide, normalViewGeometry, select, uv, vec2} from 'three/tsl'

import {filteredWave} from '../../candidates/gpt_astra/lib/filteredWave.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

const SQRT3 = Math.sqrt(3)

/** Deep-red corner-cube retroreflectors sealed beneath clear resin. Each cell contains three mutually perpendicular optical faces. Moving past the light produces abrupt, coherent return flashes; close inspection exposes fine machining on the individual faces. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {N, T, B, facing, near} = viewerFrame()
    const q = tube.mul(vec2(84, SQRT3 * 6))
    const pitch = vec2(1, SQRT3)
    const halfPitch = pitch.mul(0.5)
    const a = q.mod(pitch).sub(halfPitch)
    const b = q.add(halfPitch).mod(pitch).sub(halfPitch)
    const local = select(a.dot(a).lessThan(b.dot(b)), a, b)
    const footprint = q.fwidth().length().max(0.00001)
    const facetVisibility = visibility(footprint, 0.16, 0.7)
    const edgeDistance = float(0.5).sub(local.x.abs().max(local.x.abs().mul(0.5)
      .add(local.y.abs().mul(SQRT3 * 0.5))))
    const inside = edgeDistance.smoothstep(footprint.mul(0.35).add(0.009), footprint.mul(0.65).add(0.026))
    const sectorA = local.y
    const sectorB = local.x.mul(SQRT3 * 0.5)
      .sub(local.y.mul(0.5))
    const sectorC = local.x.mul(-SQRT3 * 0.5)
      .sub(local.y.mul(0.5))
    const directionBC = select(sectorB.greaterThan(sectorC), vec2(SQRT3 * 0.5, -0.5), vec2(-SQRT3 * 0.5, -0.5))
    const faceDirection = select(sectorA.greaterThan(sectorB.max(sectorC)), vec2(0, 1), directionBC)
    const largest = sectorA.max(sectorB).max(sectorC)
    const smallest = sectorA.min(sectorB).min(sectorC)
    const middle = sectorA.add(sectorB).add(sectorC)
      .sub(largest)
      .sub(smallest)
    const sectorGap = largest.sub(middle).max(0)
    const creaseFilter = sectorGap.smoothstep(footprint.mul(0.25), footprint.mul(0.9))
    const cubeNormal = N.mul(1 / Math.sqrt(3))
      .sub(T.mul(faceDirection.x).mul(Math.sqrt(2 / 3)))
      .sub(B.mul(faceDirection.y).mul(Math.sqrt(2 / 3)))
      .normalize()
    const normal = mix(N, cubeNormal, inside.mul(facetVisibility).mul(creaseFilter)).normalize()
    const acceptance = facing.smoothstep(0.15, 0.62)
    const faceTint = faceDirection.x.mul(0.12)
      .add(faceDirection.y.mul(0.05))
      .add(0.82)
    const toolMarks = filteredWave(local.dot(faceDirection).mul(TAU * 9)).mul(near)
    this.envMapIntensity = 1.05
    this.colorNode = mix(color(hsl.integer(254, 19, 7)), color(hsl.integer(31, 92.6, 54)).mul(faceTint), inside)
    this.metalnessNode = inside.mul(0.05)
    this.ior = 1.58
    this.roughnessNode = float(0.17)
      .add(inside.oneMinus().mul(0.08))
      .add(facetVisibility.oneMinus().mul(0.2))
      .add(toolMarks.mul(0.025))
    this.retroreflectivityNode = inside.mul(acceptance.mul(0.7).add(0.28))
    this.normalNode = negateOnBackSide(normal)
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.055
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = inside.mul(0.22).add(0.78)
  }
}
