import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cos, float, Fn, mix, negateOnBackSide, sin, step, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Geometric hopper crystal displacement: Aggressively sculpts the knot tube into orthogonal square hopper staircases with planar cleavage cuts into the core. */
const bismuthHopperShape = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  // 4-fold square prism cross-section: strictly planar facets
  const theta = tube.y.mul(TAU)
  const cosT = cos(theta).abs()
  const sinT = sin(theta).abs()
  const squareMetric = cosT.max(sinT).max(0.15)
  // Expand cross section from circle into sharp square prism
  const squareExpansion = squareMetric.reciprocal().sub(1).mul(0.055)
  // Stepped hopper terraces along the knot tube
  const uTiers = tube.x.mul(32)
  const uLocal = uTiers.fract().sub(0.5).abs().mul(2)
  const vTiers = tube.y.mul(8)
  const vLocal = vTiers.fract().sub(0.5).abs().mul(2)
  const hopperDist = uLocal.max(vLocal)
  // Rigid stair-step profile: quantized 90-degree steps
  const steps = 6
  const steppedLedge = hopperDist.mul(steps).floor().div(steps).mul(0.035)
  // Planar cleavage cuts along 45-degree and 90-degree lattice planes
  const planeA = tube.x.mul(16).add(tube.y.mul(8)).fract().sub(0.5).abs()
  const planeB = tube.x.mul(16).sub(tube.y.mul(8)).fract().sub(0.5).abs()
  const cleavagePlane = planeA.min(planeB)
  const deepChasm = cleavagePlane.smoothstep(0.015, 0.08).oneMinus().mul(-0.048)
  const totalDisplacement = squareExpansion.add(steppedLedge).add(deepChasm)
  return p.add(normal.mul(totalDisplacement))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.3)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    // Geometric hopper displacement
    this.positionNode = bismuthHopperShape(tube)
    // Accurate finite-difference normal derived from displaced crystal hopper geometry
    const eps = 0.0003
    const du = bismuthHopperShape(tube.add(vec2(eps, 0))).sub(bismuthHopperShape(tube.sub(vec2(eps, 0))))
    const dv = bismuthHopperShape(tube.add(vec2(0, eps))).sub(bismuthHopperShape(tube.sub(vec2(0, eps))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.normalNode = negateOnBackSide(displacedNormal)
    // Hopper staircases in UV space
    const uTiers = tube.x.mul(32)
    const uLocal = uTiers.fract().sub(0.5).abs().mul(2)
    const vTiers = tube.y.mul(8)
    const vLocal = vTiers.fract().sub(0.5).abs().mul(2)
    const hopperDist = uLocal.max(vLocal)
    // Terrace step index and micro-riser
    const steps = 6
    const terraceIndex = hopperDist.mul(steps).floor().div(steps)
    const terraceRamp = hopperDist.mul(steps).fract()
    const riserWall = terraceRamp.smoothstep(0.75, 0.98)
    // Physical thin-film interference:
    // delta = 2 * n * d * cos(theta_t)
    // Film thickness d increases from thin gold/copper at sharp outer edges to thick blues/greens in recesses
    const filmThickness = float(1).sub(terraceIndex).mul(240).add(70)
    // Refractive index of Bi2O3: n ≈ 2.6
    const cosThetaT = float(1).sub(grazing.pow(2).div(2.6 * 2.6)).max(0.1).sqrt()
    const pathDiff = filmThickness.mul(cosThetaT).mul(2 * 2.6)
    // Airy interference phase across three representative wavelengths (nm):
    // Red: 650nm, Green: 530nm, Blue: 450nm
    const phaseR = pathDiff.div(650).mul(TAU)
    const phaseG = pathDiff.div(530).mul(TAU)
    const phaseB = pathDiff.div(450).mul(TAU)
    const refR = phaseR.cos().mul(0.48).add(0.52)
    const refG = phaseG.cos().mul(0.48).add(0.52)
    const refB = phaseB.cos().mul(0.48).add(0.52)
    // Saturated interference colors: gold -> magenta -> royal blue -> emerald
    const goldYellow = color(hsl.integer(85, 100, 81.6))
    const hotMagenta = color(hsl.integer(4, 100, 53))
    const royalBlue = color(hsl.integer(264.06, 100, 41.4))
    const emeraldGreen = color(hsl.integer(149.4, 100, 78))
    const thinFilm = mix(
      mix(goldYellow, hotMagenta, refR.smoothstep(0.35, 0.85)),
      mix(royalBlue, emeraldGreen, refB.smoothstep(0.35, 0.85)),
      refG.mul(0.6).add(0.2),
    ).mul(vec3(refR, refG, refB).mul(0.6).add(0.4))
    // Planar cleavage cuts along lattice planes
    const planeA = tube.x.mul(16).add(tube.y.mul(8)).fract().sub(0.5).abs()
    const planeB = tube.x.mul(16).sub(tube.y.mul(8)).fract().sub(0.5).abs()
    const cleavagePlane = planeA.min(planeB)
    const chasmMask = cleavagePlane.smoothstep(0.015, 0.08).oneMinus()
    const chasmDepth = cleavagePlane.smoothstep(0.005, 0.045).oneMinus()
    // Stepped terraces inside the chasm
    const chasmSteps = cleavagePlane.mul(60).fract().smoothstep(0.1, 0.9)
    // Volumetric absorption & blackbody emission inside chasm (Beer-Lambert depth absorption)
    const deepCrimson = color(hsl.integer(30, 100, 18))
    const moltenOrange = color(hsl.integer(34, 100, 59.5))
    const radiantAmber = color(hsl.integer(65, 100, 73.4))
    const hotGold = color(hsl.integer(101.3, 100, 93))
    const heatPulse = time.mul(0.8).add(p.x.mul(8)).sin().mul(0.15).add(0.85)
    const chasmTemp = chasmDepth.mul(heatPulse)
    const chasmGlow = mix(
      deepCrimson,
      mix(moltenOrange, mix(radiantAmber, hotGold, chasmTemp.smoothstep(0.7, 1)), chasmTemp.smoothstep(0.3, 0.7)),
      chasmTemp.smoothstep(0.05, 0.3),
    )
    // 100% metallic conductor: specular color is driven by thin-film reflection
    this.colorNode = mix(
      mix(thinFilm, color(hsl.integer(304, 21, 5)), riserWall.mul(0.8)),
      color(hsl.integer(38, 58, 6)),
      chasmMask,
    )
    this.metalnessNode = mix(float(1), float(0.02), chasmMask)
    this.roughnessNode = mix(
      mix(float(0.09), float(0.38), riserWall),
      float(0.32),
      chasmMask,
    )
    // Anisotropy aligned with orthogonal hopper facets
    const theta = tube.y.mul(TAU)
    const isVertical = step(cos(theta).abs(), sin(theta).abs())
    const growthTangent = mix(vec2(1, 0), vec2(0, 1), isVertical)
    this.anisotropy = 0.8
    this.anisotropyNode = growthTangent.mul(0.8).mul(float(1).sub(chasmMask))
    // Zero clearcoat
    this.clearcoat = 0
    // High cavity ambient occlusion in deep terrace corners
    this.aoNode = mix(float(1), float(0.35), riserWall)
    // Deep recessed chasm emission: zero grazing emission to prevent silhouette fringing
    this.emissiveNode = chasmGlow
      .mul(chasmMask)
      .mul(facing.mul(0.5).add(0.5)) // Occlude emission at grazing angles to keep inside the chasm
      .mul(chasmSteps.mul(0.3).add(0.7))
      .mul(chasmDepth.mul(2.2).add(0.4))
      .mul(near.mul(0.4).add(0.7))
      .add(radiantAmber.mul(chasmDepth.pow(2)).mul(intimate).mul(0.8))
  }
}
