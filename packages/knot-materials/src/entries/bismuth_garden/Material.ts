import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Hopper-crystal terraces are built in the knot's seamless tube coordinates. A separate crystal identity per tile keeps the rainbow architectural rather than oil-slick smooth. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.18)
    this.name = knotData.id
    const {grazing, intimate, near, p, view} = viewerFrame()
    const periods = vec2(15, 10)
    const tile = uv().mul(periods)
    const cell = wrapCell(tile.floor(), periods)
    const random = cellNoiseVec3(vec3(cell.x, cell.y, 8.2))
    const local = tile.fract().sub(0.5)
    const squareRadius = local.x.abs().max(local.y.abs())
    const squareOrientation = local.x.abs().sub(local.y.abs()).smoothstep(-0.035, 0.035)
    const terracePhase = squareRadius.mul(83).add(local.x.mul(local.y).mul(49)).add(random.x.mul(8.5))
    const terraces = opticalBands(terracePhase)
    const fineTerraces = opticalBands(terracePhase.mul(2.9).add(random.z.mul(5))).mul(intimate)
    const outerFacet = squareRadius.smoothstep(0.08, 0.48)
    const bevel = opticalBands(squareRadius.mul(148).add(random.y.mul(4))).mul(outerFacet)
    const crystalDust = cellularPoints(p.mul(42), 0.022, 0.09, 0.91).mul(intimate)
    const height = terraces.mul(0.58).add(bevel.mul(0.27)).add(fineTerraces.mul(0.14))
    const facetShift = squareOrientation.mul(0.7).add(random.y.mul(1.8)).add(view.dot(vec3(0.32, 0.71, -0.63)).mul(2.4)).add(time.mul(0.025))
    const mineral = spectralColor(terracePhase.mul(0.1).add(facetShift))
    const violetShadow = mix(color(hsl.integer(295, 54, 8)), color(hsl.integer(267, 36, 22)), terraces.mul(0.6).add(outerFacet.mul(0.14)))
    const faceColor = mix(violetShadow, mineral, outerFacet.mul(0.66).add(terraces.mul(0.24)).clamp())
    const brightEdges = mix(color(hsl.integer(156, 100, 92.7)), color(hsl.integer(86, 100, 86.6)), random.z)
    const sparkle = glints(normalViewGeometry, 145).mul(crystalDust.add(bevel.mul(grazing.pow(2.2)).mul(0.18)))
    this.colorNode = mix(faceColor, brightEdges, bevel.mul(grazing.pow(1.35)).mul(0.26))
    this.metalness = 1
    this.roughnessNode = float(0.16).add(terraces.oneMinus().mul(0.11)).add(crystalDust.mul(0.08)).clamp(0.08, 0.34)
    this.clearcoat = 0.42
    this.clearcoatRoughness = 0.055
    this.normalNode = proceduralNormal(height, 0.00135)
    this.emissiveNode = mineral.mul(bevel).mul(grazing.pow(2.7)).mul(near.mul(0.22).add(0.025))
      .add(brightEdges.mul(sparkle).mul(0.42))
  }
}
