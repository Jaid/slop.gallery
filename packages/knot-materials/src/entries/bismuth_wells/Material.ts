import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, positionGeometry, uv, vec2} from 'three/tsl'

import {thinFilm} from '../../candidates/gemini_flash/lib/thinFilm.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    // Controlled environment intensity preserves rich metallic interference contrast
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const {facing, rim, near, intimate} = viewerFrame()
    // 2D grid of hopper crystal domains along the knot surface
    const gridScale = vec2(24, 4)
    const grid = tube.mul(gridScale)
    const tileLocal = grid.fract().sub(0.5)
    // Chebyshev distance metric for square crystal symmetry: max(|x|, |y|)
    const localAbs = tileLocal.abs()
    const chebyshev = localAbs.x.max(localAbs.y)
    // Quantize into 8 discrete stepped hopper terraces
    const stepCount = 8
    const rawStep = chebyshev.mul(stepCount)
    const stepIndex = rawStep.floor().clamp(0, stepCount - 1)
    const stepFraction = rawStep.fract()
    // Stepped height elevation: staircases step down into hollows
    const terraceElevation = stepIndex.div(stepCount).mul(0.012)
    this.positionNode = positionGeometry.add(normalLocal.mul(terraceElevation))
    // Sharp orthogonal riser quantization: risers are steep 90-degree step walls
    const riser = stepFraction.smoothstep(0.82, 0.96)
    const miterDiagonal = localAbs.x.sub(localAbs.y).abs().smoothstep(0.01, 0.04).oneMinus()
    // Dynamic thin-film optical interference of bismuth oxide film (Bi2O3, n = 2.1)
    // Physical optical path difference varies with step thickness and viewer angle theta
    const oxideThickness = float(170).add(stepIndex.mul(52))
    const oxideInterference = thinFilm(oxideThickness, facing, 2.1)
    // Bismuth metallic substrate: lossy conductor with silvery-gray reflectance (R ~ 0.6)
    const bismuthSubstrate = mix(color(hsl.integer(248, 6, 65)), color(hsl.integer(74, 8, 85)), stepIndex.div(stepCount))
    const bismuthMetal = bismuthSubstrate.mul(oxideInterference.mul(0.85).add(0.15))
    this.colorNode = bismuthMetal
    this.metalness = 1
    this.roughnessNode = float(0.04).add(riser.mul(0.24)).add(miterDiagonal.mul(0.16))
    // Pure metallic conductor: no dielectric clearcoat
    this.clearcoat = 0
    // Harshly quantized orthogonal stepped normals:
    // Treads face normalViewGeometry; risers snap to lateral tangent orientation
    const riserAxis = localAbs.x.greaterThan(localAbs.y).select(vec2(1, 0), vec2(0, 1))
    const steppedBump = proceduralNormal(
      terraceElevation.sub(riser.mul(0.0035)).add(miterDiagonal.mul(0.0015)),
      1.1,
    )
    this.normalNode = steppedBump
    // Anisotropic crystal growth along square step edges
    this.anisotropy = 0.92
    this.anisotropyNode = riserAxis.mul(0.85)
    // Microscopic metallic glints along sharp crystal growth edges
    const crystalGlints = glints(steppedBump, 110).mul(riser).mul(near.mul(0.6).add(0.4))
    // Luminescent cavity gleam in the deepest sunken hopper hollows
    const cavityGlow = color(hsl.integer(65, 100, 73.4))
      .mul(stepIndex.smoothstep(1.5, 0).pow(2))
      .mul(intimate.mul(0.7).add(0.3))
      .mul(1.1)
    const stepSparkle = color(hsl.integer(0, 0, 100)).mul(crystalGlints).mul(1.8)
    const rimIridescence = oxideInterference.mul(rim.pow(2.5)).mul(0.5)
    this.emissiveNode = cavityGlow
      .add(stepSparkle)
      .add(rimIridescence)
  }
}
