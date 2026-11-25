import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 8. PRISMATIC HAUNT A cold, faceted crystal knot half-here and half-not. Each facet refuses to admit its colour until you move, then splits the incoming light into a rippling spectrum that migrates across the surface with every step you take. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Facet lattice — discretised into hard cells.
    const facetU = tube.x.mul(Math.PI * 2 * 22).floor()
    const facetV = tube.y.mul(Math.PI * 2 * 7).floor()
    const facetSeed = facetU.mul(1.37).add(facetV.mul(53.71))
    const facetRnd = cellNoiseVec3(vec3(facetSeed, facetV.mul(0.71), 0))
    const facetRnd2 = cellNoiseVec3(vec3(facetSeed.add(11.3), facetV.add(29.1), 3.7))
    // Edge network between facets.
    const edgeU = filament(tube.x.mul(Math.PI * 2 * 22).fract().sub(0.5), 0.018)
    const edgeV = filament(tube.y.mul(Math.PI * 2 * 7).fract().sub(0.5), 0.018)
    const facetEdge = edgeU.max(edgeV)
    const facetEdgeFine = filament(tube.x.mul(Math.PI * 2 * 44).add(tube.y.mul(Math.PI * 2 * 3)).fract().sub(0.5), 0.015).mul(intimate)
    // View-driven dispersion — the spectrum slides with the eye.
    const dispersionPhase = facing.mul(3.2)
      .add(tube.x.mul(2.1))
      .add(tube.y.mul(1.4))
      .add(facetRnd.x.mul(0.4))
    const spectrumA = cosinePalette(dispersionPhase, [0.5, 0.5, 0.5], [0.55, 0.55, 0.55], [1, 1, 1], [0, 0.33, 0.67])
    const spectrumB = cosinePalette(dispersionPhase.add(0.15).add(grazing.mul(0.4)), [0.5, 0.5, 0.5], [0.55, 0.55, 0.55], [1, 1, 1], [0.05, 0.38, 0.72])
    const chroma = spectrumA.add(spectrumB).mul(0.5)
    // Facet interior — cool glass, tinted by the dispersion.
    const glassCore = color(hsl.integer(251, 100, 93.4))
    const glassTint = mix(glassCore, chroma, grazing.mul(0.7).add(0.28))
    // Random per-facet brightness.
    const facetBright = facetRnd2.y.mul(0.6).add(0.55)
    const facetTinted = glassTint.mul(facetBright)
    // Intimate inner glow when the viewer crowds the surface.
    const innerGlow = intimate.mul(facing.pow(1.6))
    // Sharp facet tilt for procedural normal.
    const facetTilt = facetRnd.mul(2).sub(1).dot(vec3(0.577350269)).mul(0.55)
    this.colorNode = facetTinted
    this.transmission = 0.55
    this.thickness = 0.5
    this.ior = 1.72
    this.dispersion = 0.65
    this.attenuationColor.set(hsl.integer(234, 100, 82))
    this.attenuationDistance = 0.85
    this.metalness = 0
    this.roughnessNode = float(0.045)
      .add(facetEdge.mul(0.25))
      .add(facetEdgeFine.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.75
    this.iridescenceIOR = 1.9
    this.iridescenceThicknessNode = dispersionPhase.mul(115).add(265)
    this.normalNode = proceduralNormal(facetTilt.mul(0.14)
      .add(mx_noise_float(p.mul(80)).mul(0.05))
      .add(facetEdge.mul(0.35))
      .add(facetEdgeFine.mul(0.12)), 0.006)
    this.emissiveNode
      = chroma.mul(facetEdge).mul(near.mul(0.55).add(0.45)).mul(0.75)
        .add(chroma.mul(facetEdgeFine).mul(0.4))
        .add(color(hsl.integer(0, 0, 100)).mul(innerGlow).mul(0.55))
        .add(spectrumA.mul(rim).mul(0.7))
        .add(spectrumB.mul(grazing.pow(3)).mul(0.35))
        .add(color(hsl.integer(245, 100, 78)).mul(facing.pow(6)).mul(0.15))
  }
}
