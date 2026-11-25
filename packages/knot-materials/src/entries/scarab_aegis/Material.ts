import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, normalViewGeometry, positionGeometry, positionView, positionViewDirection} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 1.05
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.abs().pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const braggPhase = grazing.pow(1.6).mul(4.5).add(0.4)
    const structuralColor = spectralColor(braggPhase)
    const jewelColor = mix(mix(color(hsl.integer(162, 98, 65)), color(hsl.integer(84, 96.6, 81)), facing.abs().pow(2)), color(hsl.integer(293, 92, 47)), grazing.pow(1.8))
    // Shape jewel plates from real boundaries, not constant values in cubic noise cells.
    const plateBoundary = cellularBoundary(p.mul(36))
    const cuticle = plateBoundary.smoothstep(0.02, 0.3)
    const facetEdges = opticalLine(plateBoundary, 0.05)
    const facetNormal = proceduralNormal(cuticle.mul(intimate), 0.0018)
    this.metalness = 0.58
    this.normalNode = facetNormal
    this.roughnessNode = facetEdges.mul(0.12).add(0.08)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.022
    this.iridescence = 1
    this.iridescenceIOR = 1.82
    this.iridescenceThicknessNode = cuticle.mul(220).add(360)
    this.colorNode = mix(color(hsl.integer(71, 66, 8)), jewelColor, cuticle.mul(0.4).add(0.6))
    this.emissiveNode = structuralColor.mul(facetEdges).mul(near.mul(0.65).add(0.35)).mul(0.7).add(jewelColor.mul(rim.abs().pow(2)).mul(0.38)).add(color(hsl.integer(98.1, 97, 89)).mul(facing.pow(8)).mul(near).mul(0.25))
  }
}
